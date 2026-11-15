---
title: Design a rate limiter
seoTitle: Design a rate limiter: system design walkthrough
summary: Design a rate limiter for a system design interview: compare token bucket and sliding window, decide where to enforce, and share counters across servers.
section: guides
order: 21
aliases: system design primer, rate limiter, rate limiting, throttling, token bucket, sliding window, leaky bucket, api limits, system design interview
---

A rate limiter counts requests per client and refuses the ones over a limit, usually with HTTP 429. Run it at the gateway, key it by API key or IP, keep the counters in Redis so every server sees the same count, and use a token bucket unless you need exact windows. The hard parts are the algorithm's burst behavior and keeping a shared counter fast and correct.

This question is in the [System Design Primer](https://github.com/donnemartin/system-design-primer)'s [list of additional questions](https://github.com/donnemartin/system-design-primer#additional-system-design-interview-questions), and the reference it lists is Stripe's article on rate limiters.

## Requirements

Functional:

- Limit requests per client, per endpoint, with different rules for different tiers.
- Return 429 with a Retry-After header when a caller is over.

Non-functional:

- Adds under 5 ms to a request, since it sits on every one.
- Works across many servers, so a client cannot get ten times its limit by hitting ten machines.
- Fails open: if the limiter's store is down, traffic passes.

## Estimate the load

Assume 1 million active clients and 50,000 requests per second at peak, each needing one check.

- Throughput: 50,000 counter operations per second. One Redis node handles about 100,000 simple operations per second, so one node fits and a replica covers failure.
- Memory: a token bucket needs a token count and a timestamp, about 50 bytes with the key. 1,000,000 x 50 B is 50 MB.
- A sliding window log stores one timestamp per request. At 100 requests per client per minute that is 100 x 8 B x 1,000,000, or 800 MB. Ten times more.

## The design

The check happens before the work, so put it as early as the client identity is known.

### Where to enforce

At the [API Gateway](/components/gw), refused requests cost the services behind it nothing. A middleware inside each service works but spends CPU on requests it will reject. A per-client limit needs an identity, so it sits after authentication, and a coarse per-IP limit can sit in front of that.

### The algorithms

| Algorithm              | Behavior                                                       | Cost                                    |
| ---------------------- | -------------------------------------------------------------- | --------------------------------------- |
| Token bucket           | Refills at the limit rate, allows bursts up to the bucket size | Two numbers per client                  |
| Leaky bucket           | Drains at a fixed rate, smooths output                         | A queue per client                      |
| Fixed window           | Counter reset each minute                                      | Up to 2x the limit across a window edge |
| Sliding window counter | Weights the previous window by overlap                         | Two counters, close to exact            |
| Sliding window log     | Stores every timestamp                                         | Exact, most memory                      |

Stripe and most public APIs use a token bucket. See [rate limiting](/patterns/rate-limiting) and the [token bucket](/glossary/token-bucket).

### Shared counters

Keep state in Redis and update it with one atomic Lua script, so the read, the refill and the decrement cannot interleave. Two servers that read then write separately will both let the last request through. Give each key a TTL equal to the window, so idle clients vanish from the [Cache](/components/cache)-style store on their own.

## Where it breaks

**The counter store becomes the hot spot.** One client with huge traffic is one key, so one shard. Keep a small local allowance in each server and sync with Redis in batches, accepting a little overshoot. See [hot keys and hot shards](/patterns/hot-keys-and-hot-shards).

**Limited clients retry and make it worse.** A rejected client that retries instantly adds load. Send Retry-After and require [retry with backoff](/patterns/retry-with-backoff). The [Retry storm](/incidents/retry-storm) incident shows this loop.

**A limit blocks good users along with bad.** A single cap cannot tell a bot from a shopper. Pair the limiter with a [WAF and bot management](/patterns/waf-and-bot-management), and see the [Bot surge](/incidents/bot-surge) incident. When a server is full, [load shedding](/patterns/load-shedding) answers a different question: how busy we are, not who is calling.

## Build it in Quorum

The first board is the enforcement point. An [API Gateway](/components/gw) with a rate limit sits after Users, in front of an [App Server](/components/server) and a [Database](/components/database). Research [API gateway](/research/api-gateway) to unlock it, and [Rate limiting](/research/rate-limiting) to add the token bucket burst option. Above the limit the Gateway answers `throttled` and the App Server never sees the request, so look at the errors in the caption, which come from the limit and not from capacity. The pattern is [rate limiting](/patterns/rate-limiting).

::Design{id="gateway-rate-limit"}

The second board is the other protection, which answers a different question. The App Server is too small for its Users, and it refuses whole request kinds, lowest value first, once it passes its load line. Look at which kinds stay fast. The limiter asks who is calling, and shedding asks how busy the server is. It uses an [App Server](/components/server) and a [Database](/components/database), and [load shedding](/patterns/load-shedding) is the pattern.

::Design{id="shed-low-value"}

The game covers the algorithm choice at one place: a flat cap or a token bucket on a single Gateway. It has one cap for the whole Gateway, not one per client, and no shared counter store, so per-client keys and distributed counting stay on paper. The [Bot surge](/incidents/bot-surge) incident shows why a cap alone is not a bot filter.

## Common questions

### Which rate limiting algorithm is best?

Token bucket for most APIs, because it allows short bursts and needs only two numbers per client. Use a sliding window counter when you need a smooth, near-exact limit without a burst allowance.

### Where should a rate limiter run?

At the API gateway or edge, before the services, so rejected requests are cheap. Add a second, coarser limit near sensitive backends such as a database or a paid third-party API.

### How do you rate limit across multiple servers?

Store the counters in a shared fast store such as Redis and update them atomically with a script. Each server asks the store, so all of them see one count per client.

### What happens if the rate limiter goes down?

Fail open for most APIs, so an outage in the limiter does not become an outage of the product. Keep a coarse local limit on each server as a backstop.
