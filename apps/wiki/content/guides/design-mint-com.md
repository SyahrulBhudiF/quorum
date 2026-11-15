---
title: Design Mint.com
seoTitle: Design Mint.com: system design interview walkthrough
summary: Design a Mint.com style finance app for a system design interview: account sync, categorizing transactions, budgets and alerts, and what Quorum teaches.
section: guides
order: 31
aliases: mint, mint.com, personal finance, plaid, bank sync, transaction categorization, budget, system design primer, system design interview
---

Mint pulls transactions from banks, labels each one with a category, and compares the monthly totals with a budget. Run the bank pull as asynchronous jobs on a queue, because banks are slow and unreliable. Categorize with a seller lookup table, keep transactions in a store sharded by user, and compute budget totals as new transactions arrive, so the dashboard reads a small precomputed table.

This is one of the questions in the [System Design Primer](https://github.com/donnemartin/system-design-primer), and its [solution for Mint.com](https://github.com/donnemartin/system-design-primer/blob/master/solutions/system_design/mint/README.md) is worth reading next to this page.

## Requirements

Functional:

- A user links a bank or card account.
- The service syncs new transactions on link, on manual refresh, and daily for recently active users.
- Each transaction gets a category, and the user can override it.
- The user sets monthly budgets per category and gets a notification near or over the limit.

Non-functional:

- Highly available reads. A stale dashboard is fine, a missing one is not.
- Bank credentials are never stored in plain text.
- Notifications can be minutes late.

## Estimate the load

Assume 10 million users, 3 financial accounts each, and about 5 billion new transactions a month.

- Write rate: 5,000,000,000 / 2,500,000 seconds is about 2,000 transactions a second.
- Storage: at 50 bytes a row, 5 billion a month is 250 GB, which is 9 TB over three years. That fits a sharded database comfortably.
- Sync jobs: 30 million accounts refreshed daily is about 350 jobs a second on average. Banks are slow, so say a job takes 20 seconds. That is 7,000 jobs in flight.
- Reads: 500 million a month is about 200 a second. The workload is write-heavy.

## The design

### Linking an account

The client calls the Accounts API, which stores the institution and an encrypted token or credential in a relational [Database](/components/database). Most real apps use an aggregator such as Plaid and keep only the token it returns, never the bank password.

### Extracting transactions

Fetching from a bank takes seconds and fails often, so the API never does it inline. It puts a job on a [Queue](/components/queue) such as SQS and returns. A pool of [Workers](/components/worker) pulls jobs, calls the bank, saves the raw response to [Object Storage](/components/storage), and parses it into rows. See [queue load leveling](/patterns/queue-load-leveling). The daily sync is a scheduler that enqueues jobs for users active in the last 30 days, spread over the day.

### Categorizing

Keep a seller-to-category dictionary seeded with the popular merchants. Fifty thousand entries is a few megabytes, so every Worker holds it in memory. For unknown sellers, use the most common manual override across users, and fall back to "Uncategorized". Re-categorizing old rows is out of scope.

### Transactions and budgets

Write transactions to a store partitioned by `user_id`, since every query is per user. When a Worker inserts a row, it also adds the amount to a `monthly_spending` row for that user, month and category, and checks it against the budget. If the total crosses a threshold, it enqueues a notification job. The dashboard reads that small table, not the transactions. See [precomputation](/patterns/precomputation) and [sharding](/patterns/sharding).

### Reports

Trend charts over years scan a lot of rows. Send them to a warehouse, not the primary. See [reports off the primary](/patterns/reports-off-the-primary-warehouse).

## Where it breaks

**A bank is slow or down.** Jobs for that bank pile up and hold Workers. Use short timeouts, [retry with backoff](/patterns/retry-with-backoff), and a per-bank concurrency cap so one bank cannot take every Worker. See [bulkhead](/patterns/bulkhead).

**Jobs run twice.** Queues deliver at least once. Make inserts idempotent by keying each transaction on the bank's transaction ID. See [idempotency keys](/patterns/idempotency-keys).

**Everyone syncs at once.** A 6 a.m. daily trigger makes a spike. Jitter the schedule per user.

**The hot read path.** A month-end dashboard rush hits a few big tables. Cache the summary rows. See [cache-aside](/patterns/cache-aside).

## Build it in Quorum

The sync pipeline is the part the game models best. This board puts a Queue between the App Server and the Database, with [Queue](/components/queue) and [Worker](/components/worker) draining at their own pace:

::Design{id="queue-leveled"}

Watch what the user waits for, which is only the enqueue, and what happens to Queue depth when work arrives faster than the Workers drain it. That is the bank-sync burst.

Banks fail, so the second board compares retry policies against a slow dependency, with the same short timeout on a Link into an undersized Database:

::Design{id="retries-backoff"}

The Design uses backoff and shows the errors and the p99 against the naive version on [Retry with backoff](/patterns/retry-with-backoff). Backoff holds the extra calls down but does not fix the capacity.

The third board moves reports off the primary, using a [Data Warehouse](/components/warehouse):

::Design{id="reports-on-warehouse"}

It shows report scans going to the Warehouse while ordinary requests keep the Database. That matches the trend-chart split.

Research [Background jobs](/research/background-jobs), [Message queues](/research/queues), [Timeouts and retries](/research/timeouts) and [Data warehousing](/research/data-warehouse). The [Report kills the database](/incidents/report-db) and [Retry storm](/incidents/retry-storm) incidents are the failures above, and [Stop a retry storm](/guides/stop-a-retry-storm) walks through a fix.

The game has no bank connections, credentials, categories, budgets or notifications on a threshold. Notifications exist only as a research topic, not as budget alerts, and the Company has no per-user data model.

## Common questions

### How does Mint sync transactions from banks?

It uses a queue of sync jobs and a pool of workers that call each bank or an aggregator such as Plaid. The user's request only enqueues a job, and the worker saves new transactions when the bank answers.

### How do you categorize transactions at scale?

Look up the seller in a dictionary of known merchants held in memory. For unknown sellers, use the category most users chose by hand, and let the user override it.

### How do you send budget alerts without delaying syncs?

Update the monthly total as each transaction is written, and put a notification job on a separate queue when it crosses the limit. Alerts can be a few minutes late, so they stay off the sync path.

### Is Mint.com in the System Design Primer?

Yes. The [Primer's solution](https://github.com/donnemartin/system-design-primer/blob/master/solutions/system_design/mint/README.md) covers account linking, extraction, categorization and budgets, and this page covers the same ground with its own estimates.
