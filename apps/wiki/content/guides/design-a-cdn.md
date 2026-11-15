---
title: Design a content delivery network like Cloudflare
seoTitle: Design a CDN like Cloudflare: interview guide
summary: Design a CDN for a system design interview: edge caches, anycast and DNS routing, cache hierarchy, purge, and origin shield, and what Quorum teaches.
section: guides
order: 38
aliases: cdn, content delivery network, cloudflare, akamai, fastly, edge cache, anycast, origin shield, cache purge, system design primer, system design interview
---

A CDN is many cache servers in many cities, with a routing layer that sends each user to a nearby one. An edge server answers from its cache when it can, asks a regional cache when it cannot, and only then asks the origin. Routing is done by anycast or DNS, and a purge system removes stale content everywhere.

This is one of the questions in the [System Design Primer](https://github.com/donnemartin/system-design-primer)'s [list of additional questions](https://github.com/donnemartin/system-design-primer#additional-system-design-interview-questions).

## Requirements

Functional:

- Serve static files, images and video from a location near the user.
- Fetch from the customer's origin on a miss, and cache by rules and TTL.
- Purge a URL or a tag across the whole network.

Non-functional:

- Low latency, ideally one short hop from the user.
- Absorb traffic far above what the origin could take, including attacks.
- Keep serving when a data center or a link fails.

## Estimate the load

Assume 200 points of presence, 50 Tbps of peak traffic across the network, and an average object of 500 KB.

- Request rate: 50 Tbps is 6.25 TB a second. Divided by 500 KB, that is about 12.5 million requests a second.
- Per point of presence: 12.5 million divided by 200 is about 62,000 requests a second on average, and the biggest sites take several times that.
- Origin load: at a 95% hit rate, 5% of 12.5 million is 625,000 requests a second reaching origins in total. Across a million customers that is small, but one customer's cold object can still draw every edge at once.
- Storage: a point of presence caching 50 TB of the hottest content needs hundreds of disks, so edges use RAM for the hottest objects and SSD for the rest.

Bandwidth dominates the cost, and the hit rate decides what origins see.

## The design

### Routing the user

Two methods bring a user to an edge. With [GeoDNS](/glossary/geodns), the CDN's DNS server answers with the address of a nearby point of presence, chosen by the resolver's location and server health. With [anycast](/glossary/anycast), every point of presence announces the same IP address over BGP, and the internet's routing sends each packet to the topologically nearest one. Cloudflare uses anycast, and traffic shifts away from a failed site when its announcement is withdrawn. DNS gives finer control, and anycast reacts faster and also spreads attack traffic.

### Edge cache

The edge terminates TLS, then looks up the object by cache key, usually the URL plus selected headers. A hit returns from memory or SSD. Each server holds a slice of the point of presence's content, picked by hashing the key, so the site caches more distinct objects and not the same hot ones in every box. Eviction is LRU or a variant. The cache key must leave out tracking parameters and include anything that changes the response, or users see each other's pages.

### Cache hierarchy and origin shield

An edge that misses asks an upper-tier cache in its region, and only that tier goes to the origin. With 200 edges that would each fetch the same new video, a shield tier turns 200 origin fetches into a handful. Concurrent misses for one object at one tier are coalesced into a single fetch. See [cache warming and tiered caching](/patterns/cache-warming-and-tiered-caching).

### Origin fetch and freshness

The CDN fetches with the `Cache-Control` headers the origin sends. TTLs set how long an object lives, and `stale-while-revalidate` serves a slightly old copy while one request refreshes it. Large files are fetched in ranges, so a viewer can start before the whole file has been cached.

### Purge

A purge request goes to a control plane that fans it out to every point of presence, usually over a message bus. Purge by URL is simple. Purge by tag, such as everything for one product, needs an index from tags to cached objects. Fast global purge in about a second is a selling point at Fastly and Cloudflare. See [CDN push and pull](/patterns/cdn-push-and-pull).

## Where it breaks

**Cold start after a purge.** A global purge empties every edge, and every edge refetches from the origin together. The shield tier and request coalescing absorb most of it. Purge by tag and not everything.

**Wrong cache key.** Leaving the cookie out of the key can serve one user's account page to another. Never cache responses that set cookies unless the key accounts for them. See the [Cached page leak](/incidents/page-leak) incident.

**Long tail objects.** Most requests are for popular files, but a vast number of files are asked for once. Those always miss, and they flush useful objects from the cache. Admit an object only on its second request.

**Attack traffic.** A DDoS aimed at the CDN's own addresses is spread across hundreds of sites by anycast, and a [WAF](/components/waf) filters what remains. See [WAF and bot management](/patterns/waf-and-bot-management).

## Build it in Quorum

The game's [CDN](/components/cdn) is the edge cache. The first board puts a CDN in front of the origin. Look at how the App Server and Database loads fall and how the hit ratio, TTL and purge on deploy trade freshness for hits.

::Design{id="cdn-in-front"}

The second shows pull, where the edge fills from the origin on a miss, as in the origin fetch step.

::Design{id="cdn-pull"}

The third is Netflix's [Open Connect](/patterns/own-the-edge), a CDN built and placed by the company itself, with a CDN for the bytes and a Cache for personal data.

::Design{id="netflix-own-cdn"}

The fourth is the routing problem. Look at what far Users pay when they enter one home region, and compare it with [Multi-region with GeoDNS](/patterns/multi-region-with-geodns).

::Design{id="far-users"}

Research [Content delivery](/research/cdn) and [Tiered caching](/research/tiered-caching), and read [Static files on object storage and a CDN](/patterns/static-files-on-object-storage-and-a-cdn). The [Premiere spike](/incidents/premiere-spike) incident tests an edge under a burst, and the [Far Away](/sandboxes/far-away) Sandbox shows distance as the cause of slowness.

The game models one managed CDN and pull only. It has no points of presence you place, no anycast announcements, no purge by tag, and no per-region shield you configure. Tiering is an effect of research and not a topology.

## Common questions

### How does a CDN route users to the nearest server?

Either DNS returns the address of a close point of presence, or every site announces the same anycast address and internet routing delivers each packet to the nearest. Anycast also moves traffic away from a failed site automatically.

### What is an origin shield?

It is an extra cache tier between the edges and your origin. Many edges that miss on the same object ask the shield, and only the shield fetches from the origin.

### How does a CDN purge content everywhere?

A control plane sends the purge to every point of presence, which drops the matching objects. Tagged purges need an index from tags to objects, so that one command can clear a whole group.

### What is the difference between push and pull CDNs?

With pull the edge fetches an object from your origin the first time someone asks. With push you upload files to the CDN yourself, which suits large files that rarely change.
