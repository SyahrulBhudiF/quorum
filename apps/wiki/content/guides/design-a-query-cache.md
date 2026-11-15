---
title: Design a key-value store for a search engine
seoTitle: Design a search engine query cache: interview guide
summary: Design a query cache in front of a search backend for a system design interview: LRU eviction, TTL, sharding the cache, hot queries, and what Quorum teaches.
section: guides
order: 33
aliases: query cache, search cache, lru cache, key-value cache, memcached, redis, cache invalidation, system design primer, system design interview
---

A query cache sits between the web servers and the search backend and answers repeat searches from memory. Key it by the normalized query, evict the least recently used entries, and expire each one after a short TTL so results do not go stale for long. When one node cannot hold the hot set, split the keys across several cache nodes by hash.

This is one of the questions in the [System Design Primer](https://github.com/donnemartin/system-design-primer), and its [solution for the query cache](https://github.com/donnemartin/system-design-primer/blob/master/solutions/system_design/query_cache/README.md) is worth reading next to this page.

## Requirements

Functional:

- A search that was seen recently returns from the cache.
- A search that was not seen goes to the backend, and the answer is stored.
- Popular queries stay cached, and rare ones may fall out.

Non-functional:

- Lookups take about a millisecond, so the cache must live in memory.
- The service stays up when a cache node dies. Missing the cache is slow, and it must never be an error.
- Results can be a few minutes old, but a deleted page should not show up for hours.

## Estimate the load

Assume 10 billion searches a month and 2.5 million seconds in a month.

- Average rate: 10B / 2.5M is 4,000 searches a second. Peak at three times the average is 12,000.
- Traffic is skewed. Assume 50 million distinct queries draw 90% of searches, and the rest are one-offs.
- Entry size: the normalized query is about 50 bytes, and a page of ten titles and snippets is about 2 KB. So 50M entries are about 100 GB.
- Backend load: at a 90% hit rate, the backend sees 10% of 12,000, or 1,200 a second at peak. Raise the hit rate to 95% and it sees 600.

One Redis node holds a few tens of gigabytes comfortably, so 100 GB means four or five nodes. The backend savings matter more than the memory bill.

## The design

### Query normalization

Before any lookup, the Query API lowercases the text, strips markup, trims spaces, and fixes obvious typos. "Cheap Flights NYC" and "cheap flights nyc " should hit the same key. Every query you fold together raises the hit rate for free.

### The cache

The Query API checks a memory store such as Redis or Memcached. A hit returns at once. A miss asks the search backend, writes the result under the key, and returns it. That is [cache-aside](/patterns/cache-aside), and the application owns the logic. If a cache node is down, the call falls through to the backend.

### LRU eviction

Memory is finite, so the cache drops the entry untouched for longest. The classic build is a hash map from key to a node in a doubly linked list. A read moves its node to the head, and an insert at capacity removes the tail. Both operations take constant time. Redis approximates this by sampling a few keys, which is cheaper and close enough.

### TTL and invalidation

Search results change when pages change or ranks shift, and the cache cannot know. Give each entry a TTL of a few minutes. Popular queries refresh often because they expire often, and rare ones barely matter. For urgent removals, such as a takedown, publish a delete for the affected keys.

### Sharding the cache

Hash the query key and send it to one of N nodes. Plain modulo reshuffles almost everything when N changes, so use [consistent hashing](/patterns/consistent-hashing), which moves only about 1/N of the keys. See [sharding](/patterns/sharding) for the general case. Put a replica behind each shard if losing a node's keys would swamp the backend.

## Where it breaks

**A popular entry expires.** Ten thousand requests for the same trending query miss at once and all hit the backend. Let one request rebuild the entry while the others wait or take the stale copy, and add jitter to TTLs. See [cache stampede protection](/patterns/cache-stampede-protection).

**A cold cache.** After a restart or a deploy, the hit rate is zero and the backend takes full load. Warm the cache from the previous day's top queries before sending traffic. See [cache warming and tiered caching](/patterns/cache-warming-and-tiered-caching).

**A hot shard.** One celebrity query is one key on one node. Replicate hot keys or keep a small local cache in each Query API server. See [hot keys and hot shards](/patterns/hot-keys-and-hot-shards).

**Eviction churn.** A crawler walks through millions of unique queries and pushes real hot entries out. Do not cache queries that were seen only once.

## Build it in Quorum

The first board shows the read path. It puts a [Cache](/components/cache) in front of the [Database](/components/database), and the Cache's default strategy is cache-aside with a TTL and a size. Look at how the Database load drops as the hit ratio rises.

::Design{id="cache-aside"}

The second board turns on two stampede guards on the Cache, and it answers the popular-entry problem. Compare its caption with the unguarded version on [Cache stampede protection](/patterns/cache-stampede-protection).

::Design{id="stampede-guarded"}

The third board is a Database with several shards and a hash key. In the game the shards are Databases, not Cache nodes, but the effect on key spread is the one you would explain for a cache. See [Sharding](/patterns/sharding) for what the key choice does.

::Design{id="sharded-hash-key"}

The last board puts a [Search Engine](/components/search) beside the Database, the closest thing in the game to the backend behind your cache.

::Design{id="search-engine"}

Research [Caching](/research/caching) and [Stampede protection](/research/stampede-protection) to unlock the switches. The [Cache stampede](/incidents/stampede) incident tests the cold-start case, and the [Stampede](/sandboxes/stampede) Sandbox lets you run it yourself.

The game has no LRU list, no query normalization, no per-key invalidation, and no consistent-hash ring. A Cache has a size and a hit ratio, not individual entries.

## Common questions

### How does an LRU cache work?

It pairs a hash map with a doubly linked list. A lookup finds the node through the map and moves it to the head of the list, and when the cache is full the tail node is removed. Both steps take constant time.

### How do you invalidate a search query cache?

Mostly you do not. A short TTL of a few minutes lets every entry expire on its own, which is simple and good enough for ranked results. For urgent cases, delete the specific keys when the change is published.

### How do you shard a cache across servers?

Hash the key and map it to a node, preferably with consistent hashing so that adding a node moves only a small share of keys. Clients or a proxy such as Twemproxy do the routing.

### What does the System Design Primer say about the query cache?

The Primer scopes it to cache hits, cache misses, and high availability, with an LRU cache built from a hash table and a linked list. This page covers the same ground and adds the sharding and stampede cases.
