---
title: Design Amazon's sales ranking by category
seoTitle: Design Amazon sales rank by category: interview guide
summary: Design a sales rank by category for a system design interview: log events, a batch job that aggregates the week, a cache for reads, and what Quorum teaches.
section: guides
order: 34
aliases: sales rank, amazon best sellers, top products by category, mapreduce, batch aggregation, leaderboard, system design primer, system design interview
---

A sales rank is a batch job with a cache in front of it. Sales events land in a log, an hourly job sums the last week of units per product and category, and the sorted top lists are written to a small table. Readers never touch the raw events, because the whole answer fits in memory and is the same for everyone.

This is one of the questions in the [System Design Primer](https://github.com/donnemartin/system-design-primer), and its [solution for the sales rank](https://github.com/donnemartin/system-design-primer/blob/master/solutions/system_design/sales_rank/README.md) is worth reading next to this page.

## Requirements

Functional:

- Compute the best-selling products of the past week for each category.
- Show a category's top list to any shopper.
- A product can be in several categories, and a category has no subcategories.

Non-functional:

- Lists refresh at least hourly. A rank that is an hour old is fine.
- Reads are fast and highly available.
- Heavy computation never slows down checkout.

## Estimate the load

Assume 1 billion sales a month, 10 million products, 1,000 categories, and 100 billion list views a month. A month is about 2.5 million seconds.

- Writes: 1B / 2.5M is 400 sales a second.
- Reads: 100B / 2.5M is 40,000 views a second. That is 100 reads for every sale.
- Event size: about 50 bytes (time, product, category, quantity, price). A month is 50 GB of events, and the one-week window is about 12 GB.
- Per hour: 1B / 720 is roughly 1.4M new events, a small slice of the window.
- Output: 1,000 categories times the top 100 products at about 16 bytes is 1.6 MB for the whole site.

The input is a modest batch problem. The output is tiny. Writes are not the hard part, and reads are cheap if they never reach a database that computes anything.

## The design

### Event log

Each sale emits one event. The Sales API appends it to a log and a [Queue](/components/queue) or stream, and a consumer writes batches to object storage such as S3. Appends are fast, ordered by time, and never block checkout. A sale with two categories produces one row per category.

### The aggregation job

Every hour a batch job reads the past seven days of events and runs two MapReduce-style steps. First, map each event to the pair (category, product) with its quantity, then reduce by summing. Second, sort by category and by units, descending, using the shuffle phase of the framework. Spark does this in a few lines today, but the shape is the same. The job keeps the top few hundred per category and drops the rest.

A refinement: add the last hour's totals to a saved six-day total, instead of rereading all seven days. The job stays proportional to new data.

### The rank table

The job writes a `sales_rank` table in a SQL [Database](/components/database), keyed by category and position. A swap is atomic: write the new table, then switch a pointer, so a reader never sees half a list. See [materialized views and denormalization](/patterns/materialized-views-and-denormalization), because this table is exactly a stored query result.

### The read path

The Read API serves a category from a [Cache](/components/cache) in front of the table. With a 1.6 MB working set, the hit rate is nearly 100%, and 40,000 reads a second is a light load for a few Redis nodes. Set the TTL to about the refresh period and the cache refills after each job. Static category pages can also sit on a [CDN](/components/cdn). That is [precomputation](/patterns/precomputation).

## Where it breaks

**The job runs late.** Data grows and the hourly job takes ninety minutes. Readers see an older list, and the next job starts before the last one ends. Process the delta instead of the whole window, and alert on job age.

**A hot category.** Everyone loads "Electronics" at once, so one cache key takes a large share of reads. Replicate it or hold a copy on every web server. See [hot keys and hot shards](/patterns/hot-keys-and-hot-shards).

**Skewed reducers.** One best-selling product creates a very large key, and one reducer does most of the work. Pre-aggregate in the mapper, and salt the key if needed.

**Fresher ranks for hot items.** If popular products must update within minutes, add a streaming counter beside the batch job. The batch result stays the source of truth. See [change data capture](/patterns/change-data-capture) for feeding that stream.

## Build it in Quorum

The first board is a [Database](/components/database) whose reports read a stored result and not a live scan. That is the rank table. Look for slightly stale answers in the ledger, which is the price of the hour-old rank.

::Design{id="materialized-report"}

The second board is the read side of the design, content that is prepared ahead and cached so each view does no work. Compare its load with a board that computes on every request.

::Design{id="precomputed"}

The third board puts a [CDC Connector](/components/cdc) between the Database and an [Event Stream](/components/log) that feeds followers such as a [Data Warehouse](/components/warehouse). It is the closest match to the event log feeding the batch job.

::Design{id="cdc-stream"}

The fourth board puts slow work on a [Queue](/components/queue) with [Workers](/components/worker), the same shape as the job that consumes sales events and keeps checkout fast. Check its caption for how the backlog drains.

::Design{id="queue-and-workers"}

Research [Materialized views](/research/precompute), [Change data capture](/research/cdc), and [Background jobs](/research/background-jobs) to unlock these. The [Report kills the database](/incidents/report-db) incident shows what happens when a scan runs on the primary, and the [Analytics on Primary](/sandboxes/analytics-primary) Sandbox lets you try the fix. See [Reports off the primary, in a warehouse](/patterns/reports-off-the-primary-warehouse) for the larger version.

The game does not run MapReduce, an hourly schedule, or a distributed sort. It has no sales events with categories and no top lists, so the ranking itself is not modeled.

## Common questions

### How do you compute a top-N list by category at scale?

Aggregate events in batch. Sum quantity per category and product, sort within each category, and keep the top few hundred. A framework such as Spark or Hadoop MapReduce does the sorting through its shuffle step.

### Should a sales rank be real time or batch?

Batch is usually right. A rank that is an hour old rarely changes what a shopper buys, and a batch job is simple and cheap. Add a streaming layer only for the few items where minutes matter.

### How do you serve millions of reads on a ranking?

Precompute the answer and cache it. The full set of top lists is only a couple of megabytes, so each read is a memory lookup that does no computation.

### What does the System Design Primer use for the sales rank?

The Primer logs sales to an object store, runs a two-step MapReduce job, and writes a `sales_rank` table that a Read API serves. This page keeps that outline and adds the cache and the late-job case.
