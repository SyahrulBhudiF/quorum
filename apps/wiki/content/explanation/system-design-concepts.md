---
title: System design concepts
seoTitle: System design concepts explained, with examples
summary: The concepts behind most system design questions, grouped by the problem each one solves, with a page for every one and a way to try it in the game.
section: explanation
order: 20
aliases: system design concepts, system design basics, system design cheat sheet, distributed systems concepts, scalability concepts, system design fundamentals
---

Most system design questions come down to about fifty ideas, and each one answers a specific problem: too much traffic, data that does not fit on one machine, a dependency that fails, a number that hides the real picture. This page groups them by problem. Every entry links to a page that explains it, and most have a Component or Sandbox in Quorum where you can watch it work on live traffic.

## When one server is not enough

Start by making the app tier something you can copy. [Stateless app servers](/patterns/stateless-app-servers) keep no session in memory, so any copy can answer any request. Then [several app servers behind a load balancer](/patterns/several-app-servers-behind-a-load-balancer) spread the work. The choice between [vertical and horizontal scaling](/patterns/vertical-and-horizontal-scaling) is a cost question, and [scale up first](/patterns/scale-up-first) argues that a bigger box is often the cheaper answer for longer than people expect.

- [Load balancing algorithms](/patterns/load-balancing-algorithms): round robin, least connections, and what each does when one server is slow.
- [Layer 4 and layer 7 load balancing](/patterns/layer-4-and-layer-7-load-balancing): routing by connection or by request contents.
- [Sticky sessions](/patterns/sticky-sessions): pinning a user to one server, and why it makes scaling down harder.
- [Autoscaling the compute tier](/patterns/autoscale-the-compute-tier): adding copies when load rises, and why a slow start makes it arrive late.

## Reading the same data again and again

A cache answers repeated reads from memory so the database does not have to. [Cache-aside](/patterns/cache-aside) is the default, and [write-through and write-behind](/patterns/write-through-and-write-behind) change when a write reaches the database. A hot key expiring can send every reader to the database at once, which [cache stampede protection](/patterns/cache-stampede-protection) prevents.

- [CDN push and pull](/patterns/cdn-push-and-pull): serving files from a server near the reader.
- [Static files on object storage and a CDN](/patterns/static-files-on-object-storage-and-a-cdn): taking images and downloads off the app servers entirely.
- [Cache warming and tiered caching](/patterns/cache-warming-and-tiered-caching): starting warm after a restart, and layering caches.
- [Precomputation](/patterns/precomputation): doing the expensive work before anyone asks.

## When the database is the limit

Reads and writes hit the database differently, so they scale differently. [Read replicas](/patterns/read-replicas) copy the data to servers that only answer reads, and [replication strategies](/patterns/replication-strategies) explain what happens to a write on the way. When writes are the limit, [sharding](/patterns/sharding) splits the data across servers, and [consistent hashing](/patterns/consistent-hashing) decides which server owns a key without moving most keys when the set of servers changes.

- [Hot keys and hot shards](/patterns/hot-keys-and-hot-shards): one key that gets most of the traffic defeats an even split.
- [Connection pooling](/patterns/connection-pooling): a database accepts few connections, and many app servers can use them all.
- [Materialized views and denormalization](/patterns/materialized-views-and-denormalization): storing the answer instead of computing it per read.
- [Document and wide-column stores](/patterns/document-and-wide-column-stores): when the data changes shape or writes outgrow one machine.
- [Full-text search and the inverted index](/patterns/full-text-search-and-inverted-index): why a search engine sits beside the database.
- [OLTP and OLAP split](/patterns/oltp-and-olap-split): keeping reports off the database that takes orders.

## When copies of the data disagree

Once data lives in more than one place, the copies can differ for a while, and a design has to say how long that is acceptable. [CAP and PACELC](/patterns/cap-and-pacelc) state the tradeoff, and [consistency models](/patterns/consistency-models) list the choices from strict to eventual. [Quorum reads and writes](/patterns/quorum-reads-and-writes) let a store pick its point on that line per request.

- [Consensus and leader election](/patterns/consensus-and-leader-election): how a group of servers agrees on one value or one leader.
- [Read your writes](/patterns/read-your-writes): making sure a user sees what they just saved.
- [Two-phase commit](/patterns/two-phase-commit) and the [saga](/patterns/saga): two ways to change data in several places, and what each costs when a step fails.
- [CRDTs](/patterns/crdts): data types that merge without a coordinator.

## Work that does not need to happen now

A queue lets a fast producer hand work to a slower consumer. [Slow work to a queue and workers](/patterns/slow-work-to-a-queue-and-workers) is the basic move, and [queue load leveling](/patterns/queue-load-leveling) shows why it smooths a spike. [Publish-subscribe](/patterns/publish-subscribe) sends one event to many consumers, and [competing consumers](/patterns/competing-consumers) share one queue between many workers.

- [Dead-letter queue](/patterns/dead-letter-queue): where a message goes after it fails too many times.
- [Idempotency keys](/patterns/idempotency-keys): making a retried request safe to repeat.
- [Transactional outbox](/patterns/transactional-outbox): saving a change and announcing it without losing one of the two.
- [Change data capture](/patterns/change-data-capture): turning database changes into events.
- [Fan-out on write and on read](/patterns/fan-out-on-write-and-on-read): doing the work when a post is made or when it is read.
- [Long polling and SSE](/patterns/long-polling-and-sse) and [WebSockets](/patterns/websockets-tier-for-realtime): pushing updates to a client.

## When something fails

A slow dependency is more dangerous than a dead one, because callers wait and pile up. [Timeouts](/patterns/timeouts) bound the wait. [Retry with backoff](/patterns/retry-with-backoff) recovers from short faults, and the [circuit breaker](/patterns/circuit-breaker) stops retries from hammering a service that is down. The [bulkhead](/patterns/bulkhead) keeps one failing dependency from using every thread.

- [Load shedding](/patterns/load-shedding): dropping the least valuable work to keep the rest fast.
- [Rate limiting](/patterns/rate-limiting): capping how much any one client can send.
- [Backpressure](/patterns/backpressure): telling a producer to slow down.
- [Graceful degradation](/patterns/graceful-degradation): turning off a feature instead of failing the whole page.
- [Hedged requests](/patterns/hedged-requests): sending a second request when the first is slow.
- [Health checks and failover](/patterns/health-checks-and-failover): noticing a dead server and sending traffic elsewhere.
- [Chaos engineering](/patterns/chaos-engineering): breaking things on purpose to find out first.

## Measuring a system

You cannot fix what you read wrongly. [Percentiles, not averages](/patterns/percentiles-not-averages) shows how a mean hides the slowest users, and [tail latency](/patterns/tail-latency) explains why the slowest requests dominate once a page makes many calls. [Latency vs throughput](/patterns/latency-vs-throughput) and [Little's law](/patterns/littles-law) connect the two numbers.

- [Availability and nines](/patterns/availability-and-nines): what 99.9 and 99.99 percent mean in minutes of downtime.
- [SLOs and error budgets](/patterns/slos-and-error-budgets): agreeing how much failure is acceptable.
- [Golden signals, RED and USE](/patterns/golden-signals-red-and-use): the few metrics worth watching first.
- [RPO and RTO](/patterns/rpo-and-rto): how much data a disaster may cost and how long recovery may take.

## Common questions

### What are the most important system design concepts to learn first?

Learn load balancing, caching, replication, sharding, and queues first, because almost every interview question uses at least three of them. Add timeouts, retries, and percentiles next, since they explain why systems fail under load and how to notice it.

### How do I practice system design without an interview partner?

Build a system, put traffic through it, and see which part fails first. Quorum does this on a board: you place the Components, the Simulation sends requests through them, and each fix moves the bottleneck somewhere else, so you learn the order in which real systems break. The [first bottleneck tutorial](/tutorials/first-bottleneck) is a short start.

### Is system design only for interviews?

No. The same ideas decide whether a real service survives a launch day or a flash sale, and the [incidents](/incidents) pages show what each one looks like when it goes wrong. Interviews test the same reasoning, with a shorter clock and less data.
