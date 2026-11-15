---
title: Design a ticket booking system
seoTitle: Design a ticket booking system: interview guide
summary: Design a ticket booking system for a system design interview: flash sales, overselling, holds with expiry, queueing, and consistency, and what Quorum teaches.
section: guides
order: 29
aliases: ticket booking, ticketmaster, flash sale, overselling, seat reservation, booking, inventory, system design interview
---

A ticket system sells a fixed stock to a crowd that arrives all at once, so the design protects two things. A waiting room admits users at a rate the system can serve, and a strongly consistent database holds each seat for a few minutes with an expiry. Browsing can be stale and cached. Reserving a seat cannot.

## Requirements

Functional:

- Browse events and see which seats are free.
- Select seats, hold them while paying, then confirm the purchase.
- A seat is never sold twice.
- Release held seats if payment does not finish.

Non-functional:

- Strong consistency on inventory. Availability can give way during a surge, because a refused request is better than a double sale.
- Survive a 100x jump in traffic at the moment a sale opens.
- A payment charges exactly once, even after a retry.

## Estimate the load

Assume a stadium of 50,000 seats and 2 million fans arriving in the first minute.

- Browse load: 2M users each loading 5 pages in 60 seconds is 10M requests, about 170,000 a second. Typical days run under 1,000 a second, so this is a 170x surge.
- Booking attempts: if 10% of users reach seat selection, 200,000 attempts compete for 50,000 seats, about 3,300 a second at the peak.
- Holds: 50,000 seats held for 5 minutes is at most 50,000 live holds. That is tiny for Redis, and the load is contention and not data size.

Reads dominate and writes contend on a small stock.

## The design

### Waiting room

A virtual queue in front of the whole sale. Users get a token and a position, and the system admits them at a fixed rate, say 2,000 a minute, matching what checkout can serve. It is [load shedding](/patterns/load-shedding) and [rate limiting](/patterns/rate-limiting) with a polite face. Static pages and the seat map come from a [CDN](/components/cdn).

### Availability reads

The seat map is read by everyone and changes slowly. Serve it from a [Cache](/components/cache) with a short TTL of a second or two. A stale map makes a user click a seat that just went, and the booking step rejects it. That is acceptable.

### Holds with expiry

Selecting a seat runs an atomic conditional write: set the seat to HELD with a hold ID and an expiry only if it is currently free. Do it in a relational [Database](/components/database) with a row lock or an `UPDATE ... WHERE status = 'free'`, or in Redis with `SET NX EX`. A background job, or the expiry itself, returns unpaid seats to the pool. See [consistency models](/patterns/consistency-models).

### Booking and payment

Payment starts from the hold. Send the charge to a provider such as Stripe with an [idempotency key](/patterns/idempotency-keys) derived from the hold ID, so a timeout and retry never charge twice. On success, flip HELD to SOLD in one transaction. For multi-step flows, a [saga](/patterns/saga) with a compensating release handles a failed charge.

### Async work

Confirmation emails, PDF tickets, and analytics go through a [Queue](/components/queue) to [Workers](/components/worker). See [queue load leveling](/patterns/queue-load-leveling).

## Where it breaks

**The opening-minute surge.** Demand runs at many times normal and every layer fills at once. Autoscaling is too slow because new servers take minutes, so admit users through the waiting room, scale ahead of time on a schedule, and shed the cheap requests first. The game incident is [Flash sale](/incidents/flash-sale), and [autoscaling, reactive and scheduled](/patterns/autoscaling-reactive-and-scheduled) is the prevention.

**Overselling.** Two requests read "seat free" at once and both write "sold". This happens when the check and the write are separate steps, or when a lagging replica answers the check. Make the check and write one atomic operation on the primary, and never read inventory from a replica for booking. See [read your writes](/patterns/read-your-writes) and the [Replication lag](/incidents/repl-lag) incident.

**Double charges.** The payment provider slows, the app times out and retries, and the customer is charged twice. Idempotency keys fix it, and so does a retry cap. See the [Double charge](/incidents/double-charge) incident.

**The hot event row.** All writes target one event's inventory, so one shard takes everything. Shard inventory by event and then by seat section, as in [hot keys and hot shards](/patterns/hot-keys-and-hot-shards).

## Build it in Quorum

Three boards cover the surge and the data path. The first is the waiting room's cousin. An [App Server](/components/server) is too small for its Users, and it refuses whole request kinds, lowest value first, once it passes its load line, so the kinds that earn most stay fast. Look at the errors in the caption, since dropped requests count as errors. It is not a queue with positions, but it is the same admission idea. See [load shedding](/patterns/load-shedding) and the [Flash sale](/incidents/flash-sale) incident.

::Design{id="shed-low-value"}

The second board is capacity ahead of the sale. An [Autoscaler](/components/autoscaler) reads CPU and adds copies of the App Server, with a schedule that adds them before the known peak, and the [Load Balancer](/components/lb) uses slow start so a new copy takes traffic gradually. Look at how many copies serve at the peak. It shows why a sale needs scaling ahead of time, because new servers take minutes. See [autoscaling, reactive and scheduled](/patterns/autoscaling-reactive-and-scheduled).

::Design{id="autoscaled"}

The third board is the consistency answer. Reads go to a [Read Replica](/components/replica) and writes go to the primary [Database](/components/database), with read-your-writes routing on the App Server, so a user who just acted reads from the primary and cannot see an old copy. Look at the split of load between the two. Browsing can use the replica, and booking must read the primary. See [route reads and writes apart](/patterns/route-reads-and-writes-apart).

::Design{id="read-write-split"}

Place a [Queue](/components/queue) for checkout work, a [Payment Provider](/components/psp) for the charge, and research [Idempotency keys](/research/idempotency-keys) to watch the Double charge incident stop. The [Stale Checkout](/sandboxes/stale-checkout) Sandbox teaches why checkouts read from the primary.

The game has no seats, holds, expiry, or waiting room, and no inventory that can oversell. Consistency appears only as replication lag and read-your-writes routing.

## Common questions

### How do you prevent overselling tickets?

Make reserving a seat one atomic operation on a single authoritative store, such as a conditional update that succeeds only if the seat is free. Never decide availability from a cache or a replica at booking time.

### How do ticket holds with expiry work?

When a user picks a seat, mark it held with an expiry time of about five minutes. If payment completes, mark it sold. If the time passes, the seat returns to the pool.

### How do large ticket sellers handle a flash sale?

They put users in a waiting room and lets them in at a rate the booking system can serve, with static content on a CDN. Admission control matters more than raw server count.

### Should a booking system use strong or eventual consistency?

Use strong consistency for inventory and payment, because a double sale is costly. Use eventual consistency for browsing, where a seat map a second old does no harm.
