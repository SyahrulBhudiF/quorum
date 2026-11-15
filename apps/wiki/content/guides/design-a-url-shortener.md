---
title: Design a URL shortener or Pastebin
seoTitle: Design Pastebin or Bit.ly: system design guide
summary: Design a URL shortener or Pastebin: mint unique keys, choose 301 or 302, keep big pastes in object storage, and cache the read path.
section: guides
order: 20
aliases: system design primer, pastebin, design pastebin, bit.ly, url shortener, tinyurl, bitly, short links, link shortener, system design interview, design tinyurl
---

A URL shortener is a read-heavy key-value lookup with a small write path. Generate a unique 7-character key for each long URL, store the pair in a database, and put a cache in front of the redirect, because reads outnumber writes by about a hundred to one. The interesting decisions are how you mint keys without collisions and which redirect status you return.

This is one of the questions in the [System Design Primer](https://github.com/donnemartin/system-design-primer), and its [solution for Pastebin](https://github.com/donnemartin/system-design-primer/blob/master/solutions/system_design/pastebin/README.md) is worth reading next to this page. The primer asks for "Pastebin.com (or Bit.ly)", so this page covers both. The short link is the same, and a paste adds a body that is too big for a table row.

## Requirements

Functional:

- Create a short URL from a long one, with an optional custom alias.
- Redirect a short URL to its target.
- Links can expire. Click counts are nice to have.
- Pastebin variant: a user submits a block of text and gets a link, anonymously, with an optional expiry. Anyone with the link reads the text.
- A background job removes expired links and pastes, and monthly visit counts come from logs, so they need not be live.

Non-functional:

- Redirects answer in under 100 ms at the 99th percentile.
- Redirects stay up when the write path is down, so availability beats strict consistency.
- Short keys are not guessable in order, and a key is never reissued to a different URL.

## Estimate the load

Assume 100 million new links a month and a read to write ratio of 100 to 1.

- Writes: 100,000,000 / (30 x 86,400 s) is about 40 per second.
- Reads: 40 x 100 is 4,000 per second on average, and about 12,000 at peak if you allow 3x.
- Storage: 500 bytes per row (key, URL, timestamps) x 100 million x 12 months x 5 years is 3 TB.
- Key space: 7 characters of base62 gives 62^7, about 3.5 trillion keys. That outlasts 6 billion links by a wide margin.

For the Pastebin variant, assume 10 million pastes a month at about 1 KB of text each. That is 10 GB of new text a month, roughly 360 GB over three years, and a read to write ratio of 10 to 1. The numbers are small, so the shape matters more than the size. Real pastes vary, and a few reach megabytes.

Forty writes a second fits on one Postgres primary. Twelve thousand reads a second does not belong there, which is why the cache matters.

## The design

A request meets a [Load Balancer](/components/lb), then stateless [App Servers](/components/server), then a [Cache](/components/cache), then the [Database](/components/database).

### Generating the key

There are two honest options.

| Approach | How                                                | Cost                                                             |
| -------- | -------------------------------------------------- | ---------------------------------------------------------------- |
| Hash     | Take the first 7 characters of a hash of the URL   | Collisions, so you check and retry. Same URL gives the same key  |
| Counter  | Increment a global counter and encode it in base62 | Sequential keys are guessable, and the counter is a single point |

For counters, hand each App Server a range of, say, 10,000 IDs from a small coordinator, so it mints keys locally with no network call. Scramble the counter with a bijective shuffle if guessability matters. A collision-checked random key works too, with a unique index as the final guard.

### Redirects

Return 301 and browsers cache the redirect forever, so repeat clicks never reach you, but you lose click analytics and cannot change the target. Return 302 and every click hits your server, which keeps analytics and lets links expire. Most shorteners that sell statistics use 302.

### The read path

Reads follow [cache-aside](/patterns/cache-aside): check the cache by key, on a miss read the database and fill the cache with a TTL. A few links are hugely popular, so a cache holding the hottest 20% of keys serves most traffic. See [Add a cache](/patterns/add-a-cache).

### Pastebin: text goes to object storage

A paste is bigger than a link, and it can be much bigger. Keep the text in [Object Storage](/components/storage) under its own key, and let the [Database](/components/database) hold only the short key, the storage path, the creation time and the expiry. The row stays a few hundred bytes, so the index and the cache stay small, and the cheap store carries the bulk. A read looks up the key, then fetches the object. The write path stores the object first and the row second, so a failure leaves an orphan object a sweeper can find, and never a row that points at nothing.

Expiry has two parts. A read checks the expiry and answers "gone" for an old paste, so users never see one. A background job then scans for rows past their time and deletes the row and its object, which is where the storage bill is saved. A bucket lifecycle rule can do the object half, as in [object storage and lifecycle rules](/patterns/object-storage-and-lifecycle-rules).

Visit counts do not need to be live, so count them offline. Write each request to the access log, and a nightly job sums hits per link and month into a warehouse table. That keeps counting off the redirect path.

## Where it breaks

**A viral link stampedes the cache.** When a popular key expires, thousands of requests miss together and hit the database. Coalesce the reloads or refresh early, as in [cache stampede protection](/patterns/cache-stampede-protection). The [Cache stampede](/incidents/stampede) incident shows it.

**One key takes all the traffic.** A celebrity tweet makes one key hot, and a hash-partitioned store sends it all to one shard. Keep that key in cache and replicate it. See [hot keys and hot shards](/patterns/hot-keys-and-hot-shards) and the [Hot key](/incidents/hot-key) incident.

**The database outgrows one machine.** At 3 TB with 12,000 reads a second, add [read replicas](/patterns/read-replicas) first, then [shard](/patterns/sharding) by key. A key-value shape shards cleanly because no query spans keys. If writes outgrow one primary, a document or key-value store is a fair home for the metadata rows, and the primer lists that as a talking point too.

## Build it in Quorum

The read path is the part the game can show. Place Users, a Load Balancer, two App Servers, a Cache and a Database, and link them in that order. Research [Caching](/research/caching) to unlock the Cache. The [Read Mostly](/sandboxes/read-mostly) Sandbox is the same problem: reads dominate, Database CPU climbs, and the Cache fixes it.

This board shows the redirect lookup. Look at the Database's load with the Cache in place, because every hit is a read the Database never sees. It uses an [App Server](/components/server), a [Cache](/components/cache) and a [Database](/components/database), and the Cache is set to [cache-aside](/patterns/cache-aside) with a TTL, which is the same fill-on-miss rule as the design above.

::Design{id="cache-aside"}

Past a few thousand reads a second the long tail of cold links still reaches the Database. This board gives one Database four shards on a hash key, which spreads links evenly because a hash has no favorite. Look at whether any shard runs hotter than the rest, and note that the single [App Server](/components/server) is sized large so the shards are the limit. It is the "shard by key" answer from the scaling step, described in [sharding](/patterns/sharding).

::Design{id="sharded-hash-key"}

The third board is the other scaling step. Reads go to either the primary [Database](/components/database) or a [Read Replica](/components/replica), and writes go to the primary only, which suits a service whose writes are tens a second. Look at how the two copies share the reads, and at the read-your-writes setting on the App Server, which sends a user who just created a link back to the primary so the new link works at once. The pattern is [read replicas](/patterns/read-replicas).

::Design{id="read-replica"}

When the Cache goes cold, the [Stampede](/sandboxes/stampede) Sandbox teaches the fix.

The game covers the read path and the storage tier. It has no redirect status code and no key generator, so the 301 against 302 choice and the ID scheme stay on paper. Object Storage exists as a Component, but a paste body, an expiry job and a log-based visit count are not modeled.

## Common questions

### Should a URL shortener use 301 or 302?

Use 302 if you want click analytics or expiring links, because the browser asks you every time. Use 301 if you want to shed load and never change the target, since browsers cache it permanently.

### How do you generate unique short URLs?

Encode a counter in base62, with each App Server leasing a block of IDs so it needs no call per link. Or generate a random 7-character key and rely on a unique index to reject the rare collision. Hashing the URL works but needs collision handling.

### How long should the short key be?

Seven base62 characters give about 3.5 trillion keys, which covers billions of links with room for random keys to rarely collide. Six gives 56 billion and is enough for most products.

### How is Pastebin different from a URL shortener?

A paste stores a body, so the text goes to object storage and the database keeps the key, the path and the expiry. A short link stores only a URL, which fits in the row. Key generation, caching and replicas work the same way for both.

### How do you expire pastes?

Check the expiry on every read so an old paste never shows, then delete expired rows and their objects in a background job. A lifecycle rule on the bucket can clear the objects.

### How do you scale a URL shortener?

Cache the hot keys, add read replicas for the long tail, then shard the table by key. Writes are only tens per second, so the read path is what grows.
