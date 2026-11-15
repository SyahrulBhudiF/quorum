---
title: System design interview questions
seoTitle: System design interview questions with walkthroughs
summary: Nineteen common system design interview questions, most from the System Design Primer, each with requirements, a load estimate, a design, what breaks, and what to build in the game.
section: guides
order: 19
aliases: system design interview, system design questions, system design interview prep, hld questions, high level design questions, design a
---

The first fourteen questions come from the [System Design Primer](https://github.com/donnemartin/system-design-primer), the most widely used interview prep repository. Each page below answers one question the way a strong candidate would: it states the requirements, estimates the load, builds the design piece by piece, and names what breaks first. Each then shows what to place on the board in Quorum, so you can watch the failure instead of memorizing it.

| Question                                                                                          | The idea it teaches                                        |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| [Design a URL shortener or Pastebin](/guides/design-a-url-shortener)                              | Unique keys, and a read-heavy workload served from a cache |
| [Design a news feed or Twitter timeline](/guides/design-a-news-feed)                              | Fan-out on write versus fan-out on read                    |
| [Design a web crawler](/guides/design-a-web-crawler)                                              | Queues, politeness, and deduplicating a huge frontier      |
| [Design Mint.com](/guides/design-mint-com)                                                        | Syncing accounts and batch reports off the main database   |
| [Design the data structures for a social network](/guides/design-a-social-network-graph)          | Sharding a graph and finding paths between people          |
| [Design a key-value store for a search engine](/guides/design-a-query-cache)                      | Caching queries with LRU, sharding, and invalidation       |
| [Design Amazon's sales ranking by category](/guides/design-a-sales-rank)                          | Aggregating events into precomputed top lists              |
| [Design a system that scales to millions of users](/guides/design-a-system-for-millions-of-users) | The ladder from one box to sharded data                    |
| [Design a file sync service like Dropbox](/guides/design-a-file-storage-service)                  | Chunking, metadata, and sync                               |
| [Design a search engine like Google](/guides/design-a-search-engine)                              | Crawl, inverted index, and sharded serving                 |
| [Design a key-value store like Redis or Dynamo](/guides/design-a-key-value-store)                 | Partitioning, replication, and quorums                     |
| [Design a cache system like Memcached](/guides/design-a-cache-like-memcached)                     | Eviction, hashing across nodes, and stampedes              |
| [Design a chat app like WhatsApp](/guides/design-a-chat-system)                                   | Long-lived connections and message ordering                |
| [Design a content delivery network like Cloudflare](/guides/design-a-cdn)                         | Edge caches, routing, and origin shielding                 |
| [Design a rate limiter](/guides/design-a-rate-limiter)                                            | Counting requests fairly across many servers               |
| [Design a notification system](/guides/design-a-notification-system)                              | Queues, retries, and idempotent delivery                   |
| [Design a payment system](/guides/design-a-payment-system)                                        | Never charging twice when everything retries               |
| [Design a video streaming service](/guides/design-a-video-streaming-service)                      | Upload pipelines, object storage, and CDNs                 |
| [Design a ticket booking system](/guides/design-a-ticket-booking-system)                          | Holding scarce inventory under a flash sale                |

If a question uses a term you do not know, [System design concepts](/explanation/system-design-concepts) groups every idea by the problem it solves. If you are starting from nothing, [Learn system design by playing](/tutorials/learn-system-design) gives an order.

## Common questions

### How do I approach a system design interview question?

Ask for the requirements first, estimate the load, sketch the simplest design that works, then find its first bottleneck and fix it. Each guide here follows that order, because the order is what interviewers watch for.

### What do interviewers look for in a system design answer?

They look for clear requirements, numbers that justify each choice, and an honest account of the tradeoffs. Naming a technology matters less than saying what it costs and when you would pick something else.

### Can a game really help with interview preparation?

It helps with the part that reading cannot teach, which is the order in which a system fails as load grows. Seeing a database saturate, then a cache absorb the reads, then the queue fill, gives you a feel for bottlenecks that a diagram does not.
