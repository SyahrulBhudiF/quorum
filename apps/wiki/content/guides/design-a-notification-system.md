---
title: Design a notification system
seoTitle: Design a notification system: system design guide
summary: Design a notification system for a system design interview: queue requests, send with workers, retry safely, deduplicate, and use a dead-letter queue.
section: guides
order: 23
aliases: notification system, push notifications, email delivery, sms, fan-out, message queue, retries, system design interview
---

A notification system takes an event, decides who should hear about it, and sends push, email or SMS without making the caller wait. Accept the request, write it to a queue, and let workers pick it up and call the provider, such as APNs, FCM, SES or Twilio. Retries make delivery at least once, so deduplicate with an idempotency key, and park messages that keep failing in a dead-letter queue.

## Requirements

Functional:

- Send push, email and SMS, from an API call or an event.
- Respect user preferences and opt-outs.
- Support templates and scheduled sends.

Non-functional:

- The caller returns in milliseconds, so sending is asynchronous.
- At least once delivery, and no duplicate the user can see.
- Bursts of millions must not take down the product.
- One slow or broken provider must not block the others.

## Estimate the load

Assume 10 million users, 5 notifications per user per day.

- Volume: 10,000,000 x 5 is 50 million a day, or 50,000,000 / 86,400, about 580 per second on average.
- Peak: a campaign sends to everyone at once. 10 million messages over 10 minutes is 10,000,000 / 600, about 16,700 per second.
- Workers: if a provider call takes 100 ms, one worker thread does 10 per second, so 16,700 per second needs about 1,700 threads, or 20 machines at 100 threads each.
- Storage: 50 million log rows a day at 200 B is 10 GB a day.

The average is easy. The campaign peak is 30 times higher, and the queue absorbs it.

## The design

### Intake

A stateless API validates the request, checks preferences, stamps an idempotency key and enqueues. It returns 202 at once. See [slow work to a queue and workers](/patterns/slow-work-to-a-queue-and-workers).

### Queue and workers

Use one queue, or one topic, per channel so a slow email provider does not delay push. Workers pull in parallel, call the provider and acknowledge on success. The queue turns a burst into a steady drain, which [queue load leveling](/patterns/queue-load-leveling) explains. Several workers sharing a queue are [competing consumers](/patterns/competing-consumers).

### Fan-out

"Notify all followers" becomes one message per recipient. Do it in two steps: one event fans out to a recipient list in batches, then each batch fans out to messages. A log such as Kafka works when many services need the same event, as in [publish and subscribe](/patterns/publish-subscribe) and [fan-out on write and on read](/patterns/fan-out-on-write-and-on-read).

### Retries and idempotency

A provider call can time out after it succeeded. Retry with [backoff and jitter](/patterns/retry-with-backoff), and send the notification's idempotency key so the retry is harmless. Where the provider accepts no such key, keep a sent-set in Redis keyed by notification ID. See [idempotency keys](/patterns/idempotency-keys).

### Dead letters

After a few attempts, move the message to a [dead-letter queue](/patterns/dead-letter-queue) and alert on its depth, so a bad address cannot hold the workers.

## Where it breaks

**A retry storm.** A provider slows down, every worker retries, and the load doubles. Add backoff, a retry budget and a circuit breaker. See [Retry storm](/incidents/retry-storm) and [circuit breaker](/patterns/circuit-breaker).

**A poison message.** One malformed payload fails forever and keeps cycling. A dead-letter queue with a max attempts value is the fix. See [Poison message](/incidents/poison).

**The campaign drowns transactional mail.** A password reset waits behind ten million promos. Use separate queues by priority and give the urgent one its own workers.

## Build it in Quorum

Research [Message queues](/research/queues) and [Notifications](/research/notifications), and place a [Queue](/components/queue), a [Worker](/components/worker) and a [Push Provider](/components/msgp).

The first board is the whole send path. The App Server only hands the notification to the Queue, Workers drain it, and the Push Provider is the last hop. The Queue has its dead-letter switch on, two Worker copies do the sending, and the Link from Workers to the provider has a short timeout and backoff retries. Look at the Queue's depth and the provider's throughput, since the provider drops messages past its limit. It uses an [App Server](/components/server), a Queue, a Worker and a Push Provider, and [message platform for fan-out](/patterns/message-platform-for-fan-out) is the pattern.

::Design{id="push-fan-out"}

The second board isolates the poison message answer. A task that fails on every attempt is retried a few times with a pause, then set aside, so one bad payload cannot hold the Workers. Look at the Max attempts value and at what happens to a task that keeps failing. In the game it is lost once parked, since there is no queue to inspect. It uses a [Queue](/components/queue), a [Worker](/components/worker) and a [Database](/components/database), and [dead-letter queue](/patterns/dead-letter-queue) is the pattern.

::Design{id="queue-dlq"}

Research [Idempotency keys](/research/idempotency-keys) for duplicates.

The game covers the queue, the workers and the provider hop, and the poison message incident. It sends one message per request with no per-user preferences, so fan-out to a recipient list, templates and scheduling are not modeled. The Push Provider drops messages past its limit, so you still watch its throughput.

## Common questions

### Why use a message queue for notifications?

It lets the API return immediately and absorbs bursts, since workers drain the queue at their own pace. It also isolates a slow provider from the rest of the system.

### How do you avoid sending duplicate notifications?

Give each notification an idempotency key and record it when the send succeeds. A retry with a known key does nothing. Delivery stays at least once, and the key makes the visible effect once.

### How do you handle failed notifications?

Retry with exponential backoff and jitter a few times. Then move the message to a dead-letter queue, alert on its depth, and replay it once the cause is fixed.

### How do you send a notification to millions of users?

Split it into batches of recipients and enqueue each batch, then let workers expand batches into per-user messages. Rate limit toward the provider so the send stays inside its quota.
