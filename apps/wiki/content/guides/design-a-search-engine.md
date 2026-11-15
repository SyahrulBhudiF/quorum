---
title: Design a search engine like Google
seoTitle: Design a search engine like Google: interview guide
summary: Design a web search engine for a system design interview: crawling, the inverted index, ranking, sharded serving, and the query path, and what Quorum teaches.
section: guides
order: 36
aliases: google, web search, search engine, crawler, web crawler, inverted index, pagerank, ranking, elasticsearch, system design primer, system design interview
---

A web search engine is two systems joined by an index. An offline pipeline crawls pages, builds an inverted index and scores every page, and an online tier of index shards answers each query by asking all of them and merging the best results. Crawling can be slow and approximate. Serving has to answer in a fraction of a second.

This is one of the questions in the [System Design Primer](https://github.com/donnemartin/system-design-primer)'s [list of additional questions](https://github.com/donnemartin/system-design-primer#additional-system-design-interview-questions).

## Requirements

Functional:

- Crawl the public web and keep pages reasonably fresh.
- Take a text query and return the most relevant pages, ten at a time.
- Show a title and a snippet for each result.

Non-functional:

- Query latency well under half a second at the 99th percentile.
- Very high availability for queries. A stale index is fine, an unavailable one is not.
- Politeness: never hammer one site while crawling.

## Estimate the load

Assume 50 billion pages in the index, 100 KB of raw HTML each, and 5 billion queries a day.

- Raw storage: 50 billion times 100 KB is 5 PB. The index keeps terms and positions and not the full text, so say 1 PB for the index and a few more for stored page copies.
- Query rate: 5 billion divided by 86,400 seconds is about 58,000 queries a second on average, and perhaps 150,000 at the peak.
- Crawl rate: refreshing the whole web once a month means 50 billion pages over 2.6 million seconds, about 19,000 fetches a second. Popular pages refresh daily, so plan for more.
- Shards: if one machine holds 100 GB of index in memory and disk, 1 PB needs about 10,000 machines, before replicas.

Storage and fan-out are the hard part. A single query will touch thousands of machines.

## The design

### Crawler

A URL frontier is a prioritised queue of pages to fetch. Fetchers pull from it, honour robots.txt, and keep a per-host delay so one site sees a request every few seconds. Each fetched page is hashed to catch duplicates, parsed for links, and the new links go back into the frontier. The frontier is partitioned by host so politeness is easy to enforce. Work moves through a [Queue](/components/queue) to a fleet of [Workers](/components/worker).

### Index builder

Raw pages land in [Object Storage](/components/storage). A batch job such as MapReduce tokenizes each page and emits term to document pairs, then groups them into the [inverted index](/glossary/inverted-index): for every term, a sorted list of the documents that contain it, with positions. The same job counts links to compute a page-quality score, the idea behind PageRank in the original Google paper. Rebuild the index in batches, and publish a new generation of shards when it is ready.

### Sharded index

Split the index by document, so each shard holds the full term lists for its own slice of pages. The alternative, splitting by term, makes one query read a few huge lists across the network. Document sharding means every query goes to every shard, but each shard works alone and returns its top results. Each shard has several replicas, which add query capacity and survive a machine failure. See [sharding](/patterns/sharding).

### Query path

A query hits a front-end behind a [Load Balancer](/components/lb). The front-end cleans the query, fixes spelling, and checks a [Cache](/components/cache) of recent queries, since a small share of queries repeats all day. On a miss it fans the query out to one replica of every shard. Each shard intersects its term lists, scores candidates with a cheap formula, and returns its top 100. The root merges those lists, a second stage reranks the best few hundred with a heavier model, and the front-end fetches snippets for the final ten.

## Where it breaks

**Fan-out tail latency.** The query waits for the slowest of thousands of shards, so one slow replica makes the whole answer slow. Send a backup request to another replica after a short delay, and return partial results if a shard misses its deadline. See [hedged requests](/patterns/hedged-requests) and [tail latency](/patterns/tail-latency).

**Hot queries.** A breaking news term floods the same shards in a minute. Cache whole result pages for popular queries, with a short TTL so news stays fresh.

**A stale index.** The crawl lags and results point at dead or changed pages. Crawl important sites more often, and keep a small real-time index for recent pages that is merged with the main one at query time.

**Spam and crawler traps.** Infinite calendars and link farms eat crawl budget and pollute ranking. Cap depth per host, detect near duplicates, and score by trust and not only by text match.

## Build it in Quorum

The game models the serving half. The first board puts a [Search Engine](/components/search) beside the Database, so searches stop competing with ordinary reads. It shows the inverted index doing its job on the query path.

::Design{id="search-engine"}

The second board is the same idea tuned. It shows shards and replicas on the Search Engine and the refresh interval, which is the freshness tradeoff from the stale-index problem above.

::Design{id="search-index-tuned"}

The third swaps keyword lookup for a [Vector Index](/components/vec), the nearest-neighbour step that modern search adds for meaning-based matches. Look at how the lookup sits next to the Database and the model call.

::Design{id="vector-index"}

Research [Full-text search](/research/full-text-search) to unlock the Search Engine, and read [Search beside the database](/patterns/search-beside-the-database), [Full-text search and the inverted index](/patterns/full-text-search-and-inverted-index) and [Vector search and embeddings](/patterns/vector-search-and-embeddings). The [Cache](/components/cache) for popular queries is covered by [Add a cache](/patterns/add-a-cache).

The game does not model crawling, the URL frontier, politeness, link-based ranking, spelling correction, or a rebuild pipeline. It also has no fan-out across thousands of shards, so tail latency from fan-out stays interview theory.

## Common questions

### How does Google search work so fast?

It keeps an inverted index in memory across thousands of shards, so each query reads a few short term lists and not whole pages. Every shard answers in parallel, and popular queries come straight from a cache.

### What is an inverted index?

It maps each word to the sorted list of documents that contain it. A query for two words fetches two lists and intersects them, which is far cheaper than scanning every page.

### How do you crawl the web without overloading sites?

Keep a queue of URLs partitioned by host and enforce a delay between requests to the same host. Obey robots.txt and back off when a site slows down or returns errors.

### Is a search engine question in the System Design Primer?

Yes, it is in the Primer's list of additional questions, which has reading links and no worked answer. This page is one worked answer, written from the Google paper and general practice.
