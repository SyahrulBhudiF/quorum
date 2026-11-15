---
title: Design the data structures for a social network
seoTitle: Design a social network graph: system design guide
summary: Design a social network graph for a system design interview: friend lists, shortest path between users, sharding people, caching, and what Quorum teaches.
section: guides
order: 32
aliases: social network, social graph, friend graph, shortest path, bfs, six degrees, sharding people, graph database, system design primer, system design interview
---

A social graph is a set of people, each with a list of friend IDs, split across many servers by a hash of the person's ID. A lookup service maps an ID to the server holding that person. To find the shortest path between two users, run a breadth-first search that fetches friend lists in batches, and cache the popular people so the search rarely reaches a disk.

This is one of the questions in the [System Design Primer](https://github.com/donnemartin/system-design-primer), and its [solution for the social graph](https://github.com/donnemartin/system-design-primer/blob/master/solutions/system_design/social_graph/README.md) is worth reading next to this page.

## Requirements

Functional:

- A user searches for another person and sees the shortest chain of friends between them.
- Friendships are mutual and unweighted.
- Adding or removing a friend updates both sides.

Non-functional:

- The graph does not fit on one machine.
- Highly available, with read latency low enough that a search feels instant.
- Traffic is uneven. Celebrities and a few popular searches draw most of it.

## Estimate the load

Assume 100 million users, 50 friends each, and 1 billion searches a month.

- Edges: 100,000,000 x 50 is 5 billion directed entries, or 2.5 billion friendships stored twice.
- Storage: at 8 bytes per friend ID, 5 billion entries is 40 GB of IDs. Add profile data and indexes and it is still only hundreds of gigabytes, so the limit is memory and query rate, not disk.
- Search rate: 1,000,000,000 / 2,500,000 seconds is about 400 searches a second.
- Search cost: a path of 4 hops expands 50 friends per hop. Hop 3 alone reaches 125,000 people and hop 4 reaches about 6 million. One search can touch millions of friend lists, which is the real cost.

## The design

### Sharding people

Split people across Person Servers by `hash(person_id) mod N`. A hash spreads load evenly, where a range of IDs piles new accounts onto the last server. Use [consistent hashing](/patterns/consistent-hashing) or a shard map so adding a server moves only a share of people. See [sharding](/patterns/sharding).

### The lookup service

Clients and the graph service need to know which server holds a person. A small Lookup Service keeps that map in memory, replicated, and clients cache it. With hashing, the lookup is arithmetic and the service is just the current shard map.

### Shortest path by BFS

On one machine you would run BFS from the source, expanding friends level by level until the target appears. Across shards, the User Graph Service does the same, but fetches in batches. It collects every ID on a level, groups them by shard, and sends one request per shard. That turns millions of calls into a few hundred per level.

A better trick is to search from both ends at once and stop when the two frontiers meet. Two searches of depth 2 reach about 2,500 people each, where one search of depth 4 reaches millions.

### Caching

Friend lists of popular people appear in many searches. Put a [Cache](/components/cache) in front of the Person Servers and keep recent BFS results for popular pairs. Facebook's TAO is this idea at scale. See [cache in front of the graph](/patterns/cache-in-front-of-the-graph).

## Where it breaks

**A celebrity.** One person with 50 million friends is on a huge share of paths and draws a flood of reads to one shard. Replicate or split their entry across copies and cap how many friends a search expands from one node. See [hot keys and hot shards](/patterns/hot-keys-and-hot-shards).

**A long path.** If no path appears within 4 or 5 hops, stop and say "far apart". An unbounded BFS can cost more than the rest of the system.

**Cross-shard chatter.** Each hop hits many servers, so tail latency is set by the slowest one. Batch requests, set timeouts, and consider [hedged requests](/patterns/hedged-requests).

**Resharding.** Adding servers moves people. Keep the key in the person's ID, as in [put the shard in the ID](/patterns/put-the-shard-in-the-id), so a move does not renumber anyone.

## Build it in Quorum

The sharding step is directly playable. This board has a [Database](/components/database) with several shards on a hash key:

::Design{id="sharded-hash-key"}

Look at how the load spreads, and compare it with the range key on [Hot keys and hot shards](/patterns/hot-keys-and-hot-shards), where new users land on one shard.

The second board is the caching step, a [Cache](/components/cache) in front of a sharded Database, modeled on Meta's TAO:

::Design{id="meta-cache-graph"}

It shows a read-heavy graph served mostly from the Cache, with writes going through it to the shard. The board draws one region, not TAO's full replication.

The third board is the celebrity problem. A hot key on the Cache, with key splitting:

::Design{id="hot-key-split"}

Read the capacity figure, which stays whole when the hot key is spread over the Cache's shards. Research [Sharding](/research/sharding) and [Caching](/research/caching), and see [Scale the database](/guides/scale-the-database). The [Hot shard](/incidents/hot-shard) and [Hot key](/incidents/hot-key) incidents are the failures above, and the [Hot key](/sandboxes/hot-key) Sandbox lets you try the fix.

The game has no graph. It does not model friend lists, BFS, bidirectional search, or a lookup service, and a request is a single query to a shard, not a walk across many. Shortest-path cost you work out on paper, as above.

## Common questions

### How do you find the shortest path between two users in a social network?

Run a breadth-first search from the source, which finds the shortest path in an unweighted graph. For a large graph, search from both users at once and stop when the two searches meet, so each side only goes a few hops.

### How do you shard a social graph?

Hash each person's ID to pick the server that stores that person and their friend list. A lookup service or shard map tells the graph service where each ID lives.

### Should a social network use a graph database?

The Primer's exercise asks you to do it without one, using sharded servers and a lookup service. Graph databases like Neo4j suit smaller graphs, and at billions of edges many companies build custom stores such as TAO on sharded MySQL.

### What does the System Design Primer say about the social graph?

It scopes the problem to a search for the shortest path between two people, with people sharded across Person Servers behind a Lookup Service. This page keeps that shape and adds batching, bidirectional search and the celebrity problem.
