---
title: Design a system that scales to millions of users
seoTitle: Design a system for millions of users: scaling guide
summary: Scale from one box to millions of users for a system design interview: load balancer, replicas, cache, CDN, queues, sharding, and what Quorum teaches.
section: guides
order: 35
aliases: scale to millions of users, scaling aws, horizontal scaling, vertical scaling, load balancer, sharding, read replicas, system design primer, system design interview
---

You do not design a million-user system on day one. You start with one server running the app and the database, then fix whichever resource runs out first: a bigger box, a load balancer and more app servers, a cache, read replicas, a CDN, a queue for slow work, and last, sharding. Each step answers a measured bottleneck, and each one adds something to operate.

This is one of the questions in the [System Design Primer](https://github.com/donnemartin/system-design-primer), and its [solution for scaling on AWS](https://github.com/donnemartin/system-design-primer/blob/master/solutions/system_design/scaling_aws/README.md) is worth reading next to this page.

## Requirements

Functional:

- A user can read and write their own data.
- The service grows from a handful of users to tens of millions without a rewrite.

Non-functional:

- Reads outnumber writes by about 20 to 1.
- Relational data, so transactions and joins matter early on.
- Availability improves at each step, because one box is a single point of failure.

## Estimate the load

Assume 10 million registered users, with 20% active on a given day.

- Requests: 2M daily users at 50 requests each is 100M a day, or about 1,160 a second. Peak at five times is 6,000.
- Writes: 1 request in 20 writes, so about 300 writes a second at peak.
- Storage: 1 KB per write at an average of 60 writes a second is about 5 GB a day. A year is under 2 TB.

One database handles a few thousand simple queries a second, so 6,000 requests with a few queries each is past one box. A year of data fits on one disk, so storage size is not what forces sharding. Write rate eventually is.

## The design

Walk it as a ladder. At each rung, name the bottleneck that sent you there.

### One box

The web server and the database share one machine, with a DNS name pointing to it. That is right for the first few thousand users. Watch CPU, memory, disk, and network so you know what runs out first.

### A bigger box

When CPU or memory runs out, buy a larger instance. It takes no code changes. The limits are cost, a ceiling on size, and a single point of failure. See [vertical and horizontal scaling](/patterns/vertical-and-horizontal-scaling).

### Split the app from the database, then add a load balancer

Move the database to its own host or a managed service such as RDS, and keep static files in object storage. When the app tier saturates, run several stateless app servers behind a [load balancer](/patterns/several-app-servers-behind-a-load-balancer) such as an ELB or HAProxy. The load balancer also checks health and drops dead servers.

### Cache

Most reads hit the same few rows. A cache such as Redis in front of the database turns most of them into memory lookups. See [add a cache](/patterns/add-a-cache) and [cache-aside](/patterns/cache-aside).

### Read replicas

When reads still outgrow the primary, add replicas. The app sends writes to the primary and reads to replicas, and replication lag means a user may not see their own write at once. See [route reads and writes apart](/patterns/route-reads-and-writes-apart) and [read your writes](/patterns/read-your-writes).

### CDN

Images, scripts, and video go to a [CDN](/patterns/static-files-on-object-storage-and-a-cdn) such as CloudFront, which serves them near the user and takes that traffic off your servers.

### Queues and workers

Anything slow, like email, image resizing, or analytics, goes into a [Queue](/patterns/slow-work-to-a-queue-and-workers) and runs on workers. The request returns at once, and the backlog drains at its own rate.

### Sharding

When one primary cannot take the write rate, split the data across several databases by a key such as user ID. This is the costliest step, because cross-shard queries and transactions get hard. See [shard the database](/patterns/shard-the-database) and [sharding](/patterns/sharding).

## Where it breaks

**Skipping the measurement.** Teams add a cache when the real problem was a missing index. Profile first, fix the cheapest thing, and load test again. See [find the bottleneck](/guides/find-the-bottleneck).

**Stateful app servers.** Sessions stored in server memory tie each user to one box, so the load balancer cannot spread them freely. Keep sessions in the cache or a signed cookie.

**A single database after all that.** Ten app servers and one primary still means one failure takes it all down. Add a standby in another zone with automatic failover.

**A hot shard.** A bad shard key sends most traffic to one database. Choose a key that spreads, as in [hot keys and hot shards](/patterns/hot-keys-and-hot-shards).

## Build it in Quorum

The game is built around this ladder. Start with one server that runs its own Postgres.

::Design{id="one-box"}

When the app tier is the limit, add servers behind a [Load Balancer](/components/lb). This board shows two smaller [App Servers](/components/server) in place of one large one, and the [vertical and horizontal scaling](/patterns/vertical-and-horizontal-scaling) page compares both.

::Design{id="scale-out"}

When the Database CPU climbs with reads, place a [Cache](/components/cache) in front.

::Design{id="cache-in-front"}

When reads still outgrow the primary, add a [Read Replica](/components/replica) and route reads to it. Watch for [Replication lag](/incidents/repl-lag).

::Design{id="read-write-split"}

When writes outgrow one primary, shard it.

::Design{id="sharded-database"}

The game also covers the other rungs without a board here. A [CDN](/components/cdn) and [Object Storage](/components/storage) take static files, and a [Queue](/components/queue) with [Workers](/components/worker) takes slow jobs. The [Scale the database](/guides/scale-the-database) guide orders the data steps, and [Survive a traffic spike](/guides/survive-a-traffic-spike) uses several at once. Research [Caching](/research/caching), [Load balancing](/research/load-balancing), and [Sharding](/research/sharding) to unlock each step, and run the [Second Server](/sandboxes/second-server) Sandbox for the first move.

The game has no DNS records to manage, no VPC subnets, and no AWS-specific services. It does not model per-user data, so the shard key spreads simulated users and not real accounts.

## Common questions

### How do you scale a web application to millions of users?

Measure, then fix the first resource that runs out. A typical order is a bigger server, a load balancer with several app servers, a cache, read replicas, a CDN, a queue for slow work, and finally sharding.

### When should you scale vertically and when horizontally?

Scale vertically first, because it needs no code changes. Move to horizontal scaling when one machine is too expensive, too large, or a single point of failure.

### When do you need to shard a database?

When write volume or data size is more than one primary can handle, even after caching and replicas. Reads rarely force it, since replicas and caches scale reads more cheaply.

### Does the System Design Primer require AWS for this question?

No. The Primer solves it on AWS, but it says the principles apply anywhere. The ladder of load balancer, cache, replicas, CDN, queues, and sharding is the same on any cloud.
