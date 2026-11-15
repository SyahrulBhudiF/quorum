---
title: Design a news feed or Twitter timeline
seoTitle: Design a news feed or Twitter timeline: guide
summary: Design a news feed or Twitter timeline: pick fan-out on write or read, handle celebrity accounts, add post search, and build the shape in Quorum.
section: guides
order: 25
aliases: system design primer, twitter timeline, facebook feed, news feed, timeline, twitter, instagram, facebook, home feed, fan-out, system design interview
---

A news feed is a read-heavy system, so build each user's timeline when someone posts and store it in a cache. That is fan-out on write. Accounts with millions of followers break it, so you pull their posts at read time and merge them in, which gives the hybrid that Twitter described publicly. Ranking and a cached timeline per user sit on top.

This is one of the questions in the [System Design Primer](https://github.com/donnemartin/system-design-primer), and its [solution for the Twitter timeline](https://github.com/donnemartin/system-design-primer/blob/master/solutions/system_design/twitter/README.md) is worth reading next to this page. The primer asks for the timeline and search, or the Facebook feed and search, so this page covers search over posts as well.

## Requirements

Functional:

- A user posts text or an image, and follows or unfollows other accounts.
- A user opens a home feed of recent posts from the accounts they follow, newest first or ranked.
- A user can also open another account's own timeline, which lists only that account's posts.
- A user searches posts by keyword.
- Opening the feed is the first screen, so it must feel instant.

Non-functional:

- Feed reads under 200 ms at the 99th percentile.
- A new post shows up in followers' feeds within a few seconds. A delay of seconds is fine, losing the post is not.
- High availability. A stale feed beats an error page, which means eventual consistency is acceptable.

## Estimate the load

Assume 300 million daily active users, each opening the feed 10 times a day and posting once on average. Assume 200 followers per account on average.

- Reads: 300M x 10 = 3 billion feed loads a day, or 3,000,000,000 / 86,400 = about 35,000 a second. Peak at 3x is roughly 100,000 a second.
- Writes: 300M posts a day is about 3,500 posts a second.
- Fan-out: 3,500 x 200 = 700,000 timeline inserts a second on average.

Search adds its own read load. If users run one search for every ten feed loads, that is roughly 3,500 searches a second on average.

Reads outnumber posts 10 to 1, and fan-out turns each post into 200 small writes. A timeline entry is a post ID and a timestamp, about 16 bytes. Keeping the newest 800 entries for 300M users is 300M x 800 x 16 = about 3.8 TB, which fits in a Redis cluster.

## The design

### API and post service

The client calls the API through a [Load Balancer](/components/lb) to stateless [App Servers](/components/server). A post is written to the post store, a sharded database keyed by post ID, and then handed to a fan-out job through a [Queue](/components/queue). The user waits only for the first write. See [slow work to a queue](/patterns/slow-work-to-a-queue-and-workers).

### Fan-out on write

[Workers](/components/worker) read the author's follower list, then insert the post ID into each follower's timeline in the [Cache](/components/cache). Reading a feed becomes one lookup. [Fan-out on write and on read](/patterns/fan-out-on-write-and-on-read) covers the trade: more writes and storage in return for fast reads.

### The celebrity rule

Above a threshold, say 100,000 followers, skip the fan-out. When a user loads the feed, the App Server fetches their cached timeline, pulls recent posts from the few celebrities they follow, and merges them by time.

### Search over posts

Search is a separate read path from the timeline. Each new post is also written to a search index, an inverted index that maps each word to the posts holding it, run as a cluster of shards. A query is split into terms, sent to every shard, and each shard returns its best matches. A coordinator merges, ranks and returns them, which is called scatter and gather. Keep the index in memory on fast machines, because search is read-heavy and users notice a slow answer. A post becomes searchable a second or two after it is written, since the index refreshes in batches, and that delay is acceptable for the same reason a feed may trail by seconds. Feed the index from the post store through a queue or change stream, not from the app in the same request, so a crash cannot leave the two disagreeing. See [full-text search and the inverted index](/patterns/full-text-search-and-inverted-index) and [search beside the database](/patterns/search-beside-the-database).

### Ranking

A chronological feed sorts by timestamp. A ranked feed takes the top few hundred candidates and scores them, using signals such as recency, closeness to the author, and past engagement. Score at read time on the candidate set, never on the whole graph.

### The user timeline

An account's own timeline is a plain read of that author's posts, newest first, from the post store. It needs no fan-out, so a database index on author and time serves it, with a [Cache](/components/cache) in front of popular accounts.

### Timeline cache and media

Timelines live in Redis as capped lists, with the newest entries first. Post bodies are fetched by ID from a second cache and the post store. Images go to [Object Storage](/components/storage) behind a [CDN](/components/cdn), as in [static files on object storage and a CDN](/patterns/static-files-on-object-storage-and-a-cdn).

## Where it breaks

**The celebrity post.** One account with 50 million followers turns a post into 50 million writes, and the workers fall behind for minutes. The fix is the hybrid above. The read side has the matching problem: millions of users ask for the same post, so one cache key runs hot. Split that key across several nodes, as in [hot keys and hot shards](/patterns/hot-keys-and-hot-shards). The game version is the [Hot key](/incidents/hot-key) incident.

**Cold timelines.** A user returns after a month and has no cached timeline, or the Cache restarts empty and every miss goes to the database at once. Rebuild on demand with the pull path, and warm the Cache before it takes traffic. That failure is a [Cache stampede](/incidents/stampede), and [cache stampede protection](/patterns/cache-stampede-protection) stops it.

**Inactive users.** Keeping timelines for everyone wastes memory on people who never return. Keep a few hundred entries for users active in the last month, and rebuild an old user's timeline from the post store with the pull path when they come back.

**Fan-out backlog.** A burst of posts after a big event fills the queue and feeds go stale. Watch queue depth and add workers, and accept that feeds trail by a few seconds. [Queue-based load leveling](/patterns/queue-load-leveling) explains why a growing queue means workers are slower than arrivals.

## Build it in Quorum

The game covers the fan-out choice well, and two boards show it. Fan-out is a setting on the [App Server](/components/server), and both boards use the same Users, a [Cache](/components/cache) and a [Database](/components/database), so the setting is the only difference.

The first board is fan-out on read. A feed request reads the latest posts of each account the user follows, so one read becomes many queries. Look at the Database load and the feed's latency, which is where the pull cost shows.

::Design{id="fanout-pull"}

The second board is fan-out on write. Each post is written into followers' timelines, so a feed request reads one list, and the cost moves to writes. Compare the Database and Cache load with the first board. Research [Hybrid fan-out](/research/hybrid-fanout) turns push into the hybrid, so the most followed accounts are pulled at read time, and the Cache here splits hot keys so a famous account does not pin one shard. That is the celebrity rule from the design above.

::Design{id="fanout-push"}

The third board is the search path. Search queries go to a [Search Engine](/components/search) and the Database keeps the rows, so searches stop loading the tier that serves the timeline. Look at the Database load and compare it with a run that has no Search Engine. It does not model scatter and gather or a refresh delay you can see per post, though the Search Engine has a refresh interval setting.

::Design{id="search-engine"}

Then run the [Hot Key](/sandboxes/hot-key) Sandbox, where a celebrity posts and you keep Apdex up. The [Wide-column Store](/components/wide) is the usual home for timelines at that scale.

The game has no ranking model, no follower graph, and no merge step you tune. It also does not model timeline length or a per-user cache. The pull, push, hot key and search mechanics are the parts it teaches.

## Common questions

### Should a news feed use fan-out on write or fan-out on read?

Use fan-out on write for most accounts, because feeds are read far more often than posts are written and a prebuilt timeline loads in one lookup. Use fan-out on read for accounts with huge follower counts. Most real systems run both.

### How do you handle the celebrity problem in a news feed?

Do not push a celebrity's posts to every follower. Store them once, and merge them into each reader's timeline when the feed loads. Cache the celebrity's recent posts so millions of readers do not hit one database row.

### How do you rank a news feed?

Generate a few hundred candidate posts from the timeline cache and the celebrity pull, then score them with a model that uses recency, relationship, and engagement signals. Return the top results. Scoring only the candidates keeps latency low.

### How does search work for a feed?

Each post is also written to a search index, an inverted index split across shards. A query goes to every shard and the best results are merged and ranked. Results lag a post by a second or two, which users accept.

### Where do you store the timelines?

In an in-memory store such as Redis, as a capped list of post IDs per user. Older entries fall off the end, and a user who scrolls past the cache falls back to a database query.
