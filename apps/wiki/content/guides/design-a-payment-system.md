---
title: Design a payment system
seoTitle: Design a payment system: system design walkthrough
summary: Design a payment system for a system design interview: use idempotency keys, avoid double charges, coordinate steps with a saga and outbox, and reconcile.
section: guides
order: 24
aliases: payment system, payments, stripe, double charge, idempotency, saga, outbox, reconciliation, ledger, system design interview
---

A payment system moves money exactly once even though networks fail and clients retry. Give every payment attempt an idempotency key, record state in a ledger inside one database transaction, call the payment provider such as Stripe, and coordinate the steps around it with a saga and a transactional outbox. Reconcile your records against the provider's every day, because something will still disagree.

## Requirements

Functional:

- Create a payment for an order, capture it, and refund it.
- Show payment status to the customer and to support.
- Support one or more providers.

Non-functional:

- Never charge twice and never lose a charge. Correctness beats latency.
- Every state change is auditable.
- Survive a provider outage, a timeout and a crash between any two steps.

## Estimate the load

Assume 10 million orders a month.

- Rate: 10,000,000 / (30 x 86,400) is about 4 per second on average. A flash sale at 20x is about 80 per second.
- Storage: each payment writes about 5 ledger rows at 300 B, so 10,000,000 x 5 x 300 B is 15 GB a month.
- Provider latency: a card charge takes 1 to 3 seconds, so at 80 per second you hold about 160 to 240 requests open at once.

This is small. A single relational database handles it. The difficulty is correctness, not scale.

## The design

### The request path

The client calls your API with an idempotency key it generated for this purchase. The [App Server](/components/server) stores the key and a PENDING payment row in one transaction, then calls the [Payment Provider](/components/psp) with the same key. See [idempotency keys](/patterns/idempotency-keys).

### Double charge

The classic failure: the charge times out at 10 seconds but succeeded, the client retries, and the customer pays twice. With a key, the provider and your own table both return the first result. The check and the write must be atomic, so use a unique index on the key.

### Orchestrating the steps

Reserve stock, charge, then ship touches three services, so no single transaction covers it. Use a [saga](/patterns/saga): each step is a local transaction, and a failure runs compensations such as a refund. Publish each step with a [transactional outbox](/patterns/transactional-outbox) so the database change and the event never disagree, and let a [Queue](/components/queue) carry them. Two-phase commit is the alternative, and [its costs](/patterns/two-phase-commit) usually rule it out.

### Ledger and reconciliation

Store money as an append-only double-entry ledger in a [Database](/components/database), never as a mutable balance. Each night compare your ledger with the provider's settlement report and flag differences for a person.

## Where it breaks

**The provider is down.** Checkouts fail as upstream errors. Queue the attempt and retry later, or fail over to a second provider. See [Payment provider outage](/incidents/psp-outage).

**Retries cause duplicates.** Retrying without a key is the double charge. Fix the key first, then add [retry with backoff](/patterns/retry-with-backoff). See [Double charge](/incidents/double-charge).

**A flash sale saturates checkout.** Demand jumps twentyfold and the database and provider saturate. Shed low-value traffic and keep checkouts, as in [load shedding](/patterns/load-shedding), and see [Flash sale](/incidents/flash-sale).

**A crash between charge and record.** The provider charged but your row says PENDING. The outbox and a sweeper that asks the provider about stale PENDING rows close this gap, and reconciliation catches what remains.

## Build it in Quorum

Place a Payment Provider after the App Server on an e-commerce Company and a Database for checkouts. Research [Checkout](/research/checkout) and [Idempotency keys](/research/idempotency-keys). The [Double charge](/incidents/double-charge) incident only happens when the charge Link retries and there is no idempotency key, which is the interview's failure in miniature.

The first board is the retry half of that story. An App Server calls an undersized [Database](/components/database) over a Link with a short timeout and backoff retries, so failed calls wait and spread out. Look at Apdex and the p99, and at how few extra calls the Database receives compared with naive retries. The charge Link to the [Payment Provider](/components/psp) takes the same policy. Backoff limits the harm of a retry, and only the idempotency key makes a retry safe, so both are needed. See [retry with backoff](/patterns/retry-with-backoff).

::Design{id="retries-backoff"}

The second board is the queue side of the design, which carries the steps that happen after the charge. The App Server hands work to a [Queue](/components/queue) and [Workers](/components/worker) drain it, with a dead-letter queue and three attempts so a failing task cannot block the line. Look at Queue depth and the Database load, because Workers read and write beside the users. It stands for the events your outbox would publish, such as a receipt or a stock update, though the game's board is an export job and not a saga. See [slow work to a queue and workers](/patterns/slow-work-to-a-queue-and-workers).

::Design{id="queue-and-workers"}

Research [Transactional outbox](/research/outbox) for the event side, and the [Stale Checkout](/sandboxes/stale-checkout) Sandbox shows why checkouts need fresh reads.

The game covers the charge, retries, duplicates and the provider outage with a second provider. It has no saga, no ledger and no reconciliation, so those you learn from the pattern pages.

## Common questions

### How do you prevent double charges in a payment system?

Send an idempotency key with every charge, and store it with the result under a unique index. A retry with a known key returns the stored result and charges nothing.

### What is an idempotency key?

A unique value the client generates once per operation and sends on every attempt. The server uses it to recognise a repeat and replay the first answer instead of acting again.

### What is the saga pattern in payments?

A saga splits a business flow into local transactions, one per service, and undoes finished steps with compensating actions when a later one fails. A refund after a failed shipment is a compensation.

### What is payment reconciliation?

It is a scheduled comparison of your ledger against the provider's or bank's records. It finds charges that exist on one side only, such as a crash between charge and record, so a person can fix them.
