---
title: Design a cache system like Memcached
seoTitle: Design a Memcached-like cache: interview guide
summary: Design a distributed cache like Memcached for a system design interview: slabs and LRU, consistent hashing, client routing, invalidation, stampedes, and Quorum.
section: guides
order: 37
aliases: memcached, redis, distributed cache, in-memory cache, lru, slab allocator, consistent hashing, cache invalidation, cache stampede, system design primer, system design interview
---

A Memcached-style cache is a fleet of dumb in-memory nodes, with the intelligence in the client. Each node stores key-value pairs in memory and evicts the least recently used one when full, and the client library hashes every key onto a ring of nodes so each key always lands on the same one. Nodes know nothing about each other.

This is one of the questions in the [System Design Primer](https://github.com/donnemartin/system-design-primer)'s [list of additional questions](https://github.com/donnemartin/system-design-primer#additional-system-design-interview-questions).

## Requirements

Functional:

- `get`, `set` and `delete` by key, with an optional TTL.
- Values up to about 1 MB.
- Add and remove nodes without a full reset.

Non-functional:

- Sub-millisecond latency on a node, and a few milliseconds end to end.
- Very high throughput, with no single machine in the way.
- The cache is allowed to lose data. The source of truth is elsewhere.

## Estimate the load

Assume a site with 500,000 reads a second at peak and a 95% hit rate, with an average value of 2 KB.

- Cache traffic: 500,000 reads a second. Each node handles perhaps 100,000 operations a second, so 5 nodes cover it and 10 give headroom.
- Misses: 5% of 500,000 is 25,000 reads a second sent to the database. Raising the hit rate to 99% drops that to 5,000.
- Memory: 200 million hot items times 2 KB is 400 GB. At 64 GB of usable memory a node, that is 7 nodes. Plan for 10 so no node runs at the limit.
- Bandwidth: 500,000 times 2 KB is 1 GB a second, so each of 10 nodes carries about 100 MB a second.

Memory sets the node count, and throughput only confirms it.

## The design

### Client-side routing

The client library holds the node list and picks the node for each key. It uses [consistent hashing](/patterns/consistent-hashing): nodes and keys are hashed onto a ring, and a key belongs to the next node clockwise. Adding or removing a node moves only its share of the keys, where `hash(key) % n` would move nearly all of them. Each node appears on the ring many times as virtual nodes, to even out the slices. No coordinator sits in the request path, so there is nothing to fail except a node.

### The node

A node is a hash table in memory behind a simple network protocol, with a multi-threaded event loop. Memcached avoids heap fragmentation with a slab allocator. Memory is cut into 1 MB pages, and each page is split into equal chunks of one size class, say 96 bytes, 120 bytes, 152 bytes and so on. An item goes in the smallest class that fits. This wastes some space inside chunks and avoids the cost of general-purpose allocation.

### Eviction

Each size class keeps its own LRU list. A read moves the item to the head, and when a class is full the tail is evicted. Expired items are dropped when someone reads them or when a background crawler passes by. Redis offers other policies, such as approximate LRU and LFU, which sample a few keys instead of tracking the full order.

### Invalidation

Most apps use [cache-aside](/patterns/cache-aside). A read checks the cache, falls back to the database on a miss, and fills the cache. A write updates the database and then deletes the key. Deleting beats updating because two racing writers can leave the older value in a cache that was updated. TTLs bound the damage from any race that still slips through.

### Replication and failure

Plain Memcached does not replicate. When a node dies, its keys miss and the database refills them. Large sites such as Facebook and Netflix add a replica pool or write to several zones, so a single node loss does not turn into a database surge.

## Where it breaks

**A cache stampede.** A hot key expires and thousands of readers all miss and hit the database together. Let one reader rebuild while the rest wait, refresh keys a little before they expire, or serve the old value while one request refreshes it. See [cache stampede protection](/patterns/cache-stampede-protection).

**A cold node.** A restarted or newly added node is empty, so its whole share of traffic goes to the database. Warm it from a key list before sending it traffic. See [cache warming and tiered caching](/patterns/cache-warming-and-tiered-caching).

**A hot key.** Consistent hashing spreads keys, not load, so one viral key sits on one node. Replicate that key across several nodes, or hold a small copy in the app server's own memory. See [hot keys and hot shards](/patterns/hot-keys-and-hot-shards).

**Stale data.** A slow reader writes an old value back after a delete. Use short TTLs, and for critical data version the value or read from the database.

## Build it in Quorum

The game's [Cache](/components/cache) is the node. The first board puts a Cache in front of the Database, so repeated reads stop at memory. Look at the Database load and the stale share in the ledger.

::Design{id="cache-in-front"}

The second board turns on stampede guards. Compare it with the unguarded version on the pattern page and watch the Database load after a cold start.

::Design{id="stampede-guarded"}

The third adds cache warming and a second tier, which is the answer to the cold node.

::Design{id="cache-warmed-tiered"}

The fourth shows a hash key spreading data across several Databases, the same placement idea the client uses for cache nodes.

::Design{id="sharded-hash-key"}

Research [Caching](/research/caching) and [Stampede protection](/research/stampede-protection), and run the [Cache stampede](/incidents/stampede) incident. The [Stampede](/sandboxes/stampede) and [Hot Key](/sandboxes/hot-key) Sandboxes isolate the two failures. A [Load Balancer](/components/lb) can also split by consistent hash.

The game does not model slabs, size classes, an LRU list, a client library, or a ring of cache nodes you add one at a time. Eviction pressure appears only as a hit rate that falls when memory is too small.

## Common questions

### How does Memcached decide where a key lives?

The client hashes the key onto a ring of servers and picks the next one clockwise. The servers never talk to each other, so adding a server moves only a small share of keys.

### What is the difference between Memcached and Redis?

Memcached is a simple multi-threaded cache of strings. Redis adds data structures, persistence and replication, and it runs commands on one thread.

### How do you keep a cache consistent with the database?

Write to the database and then delete the cached key, so the next read refills it. A TTL limits how long a missed delete can hurt.

### How do you prevent a cache stampede?

Let one request rebuild an expired key while the others wait for it, and refresh popular keys slightly early. Serving a slightly old value while one request refreshes is the third option.
