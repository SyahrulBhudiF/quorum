---
title: Learn system design by playing
seoTitle: Learn system design by playing a free game
summary: A reading and playing order that takes you from your first server to scaling data, surviving failures, and answering interview questions.
section: tutorials
order: 6
aliases: learn system design, system design course, system design roadmap, system design for beginners, system design study plan, learn scalability
---

You learn system design fastest by watching a design break under traffic and then fixing it, so this path alternates between playing and reading. Each stage starts with a few minutes in Quorum, then sends you to the pages that explain what you just saw. Stop after any stage and you have a complete idea, not half of one.

## Stage 1: one server, one database

Play [Your first Company](/tutorials/first-company) and then [Your first bottleneck](/tutorials/first-bottleneck). You will see a single server hit its limit and learn to read the cards that tell you which Node is full. Read [Capacity, utilization, and queues](/explanation/queues) to see why a Node gets slow well before it is full, and [Latency and percentiles](/explanation/latency) to see why the average hides your slowest users.

## Stage 2: more servers, then a cache

Add a second server behind a [Load Balancer](/components/lb), then put a [Cache](/components/cache) in front of the [Database](/components/database). Read [stateless app servers](/patterns/stateless-app-servers), [cache-aside](/patterns/cache-aside), and [vertical and horizontal scaling](/patterns/vertical-and-horizontal-scaling). The guide [Survive a traffic spike](/guides/survive-a-traffic-spike) shows the same ideas under pressure.

## Stage 3: when the database is the limit

Add a [Read Replica](/components/replica) and a [Connection Pooler](/components/pooler). Read [read replicas](/patterns/read-replicas), [replication strategies](/patterns/replication-strategies), and [sharding](/patterns/sharding), then [consistent hashing](/patterns/consistent-hashing) for how a key finds its server. [Scale the database](/guides/scale-the-database) walks through the order of moves.

## Stage 4: work that can wait

Put a [Queue](/components/queue) and a [Worker](/components/worker) behind slow jobs. Read [queue load leveling](/patterns/queue-load-leveling), [publish-subscribe](/patterns/publish-subscribe), and [idempotency keys](/patterns/idempotency-keys), since a queue that retries needs a request that is safe to repeat.

## Stage 5: failures

Play through [Your first incident](/tutorials/first-incident), then read [How incidents work](/explanation/incidents) and [Errors and retries](/explanation/errors-and-retries). The [retry storm guide](/guides/stop-a-retry-storm) shows how a retry policy turns a short slowdown into an outage. Then read [timeouts](/patterns/timeouts), the [circuit breaker](/patterns/circuit-breaker), and [load shedding](/patterns/load-shedding).

## Stage 6: put it into words

Read [System design concepts](/explanation/system-design-concepts) for the whole map, then try the [system design interview questions](/guides/system-design-interview-questions). Each one gives you the requirements, the load estimate, the design, and what breaks, and tells you what to build in the game to see it.

## Common questions

### Do I need to know how to code to learn system design?

No. System design is about which pieces to use and how they fit together, so you need to know what a server, a database, and a request are, and nothing more. Quorum teaches the rest by showing requests flow through the pieces you place.

### How long does it take to learn system design?

The core ideas fit into a few focused weeks. Playing each stage for twenty or thirty minutes and reading the linked pages is enough to hold a conversation about scaling a web service, and later stages give you the depth that senior interviews ask for.

### Is Quorum free?

Yes. It runs in your browser with no account and no download, and the source code is open.
