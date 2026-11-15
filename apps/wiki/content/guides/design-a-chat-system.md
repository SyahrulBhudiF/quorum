---
title: Design a chat app like WhatsApp
seoTitle: Design a chat app like WhatsApp: system design
summary: Design a chat app like WhatsApp: WebSockets, message ordering, delivery receipts, presence and partitioning, plus what Quorum teaches.
section: guides
order: 26
aliases: system design primer, chat, messaging, whatsapp, slack, discord, websocket, presence, system design interview
---

A chat system keeps one WebSocket open per online user, on a gateway tier that does nothing else. Messages go to a store partitioned by conversation, so one conversation stays ordered on one partition. Delivery receipts and presence are small events layered on top, and they cost more than they look.

This question is in the [System Design Primer](https://github.com/donnemartin/system-design-primer)'s [list of additional questions](https://github.com/donnemartin/system-design-primer#additional-system-design-interview-questions).

## Requirements

Functional:

- One-to-one and group conversations, with text and media.
- Messages arrive in order within a conversation.
- Sent, delivered, and read receipts, plus an online indicator.
- Offline users get messages when they return, and history is searchable by scrolling back.

Non-functional:

- Delivery under 200 ms to an online recipient.
- No lost messages, and no duplicates the user can see.
- Millions of idle connections, which is a memory problem and not a CPU problem.

## Estimate the load

Assume 100 million daily active users, with 20 million online at once at the peak. Each user sends 40 messages a day, and an average message is 100 bytes.

- Messages: 100M x 40 = 4 billion a day, or 4,000,000,000 / 86,400 = about 46,000 a second. Peak at 3x is about 140,000.
- Storage: 4B x 100 bytes = 400 GB a day, about 146 TB a year before replication. Triple it with replicas.
- Connections: 20M open sockets. If a gateway box holds 500,000, that is about 40 boxes plus headroom.

Connection count sets the gateway fleet, and message rate sets the store.

## The design

### Gateway tier

Clients connect over [WebSockets](/patterns/websockets-tier-for-realtime) to a fleet of gateway servers. The gateway authenticates once, then keeps the socket open. Pick a runtime that holds a connection cheaply, such as Erlang or Go, because a thread per connection will not reach a million. Short-lived requests such as login and history go to ordinary [App Servers](/components/server) and not to the gateway.

### Routing between gateways

Alice and Bob sit on different gateways. A session service, usually Redis, maps user ID to gateway. The sender's gateway looks up the recipient's gateway and forwards the message, often through [publish and subscribe](/patterns/publish-subscribe) channels per conversation.

### Message store and ordering

Write each message to a store partitioned by conversation ID, such as Cassandra or DynamoDB, with a message ID that sorts by time. Discord does this, and [partition messages by channel](/patterns/partition-messages-by-channel) shows the schema. One conversation maps to one partition, so a single writer assigns increasing sequence numbers and ordering is a property of the partition. Global ordering is never needed.

### Delivery and receipts

Send, then wait for an ack from the recipient's device. No ack means the message stays in the store as undelivered and is pushed again on reconnect. Delivery is at least once, so clients drop duplicates by message ID. See [at-least-once delivery](/glossary/at-least-once-delivery) and [idempotency keys](/patterns/idempotency-keys). Read receipts are another small message back to the sender.

### Presence

Each client sends a heartbeat every 30 seconds, and the session service sets a key with a 60-second expiry. Do not broadcast every change to every friend. Fetch presence when a conversation opens, and push changes only for the conversations on screen.

### Offline users

Store the message, send a mobile push through a push provider, and deliver the backlog on reconnect from the last message ID the client holds.

## Where it breaks

**Reconnect storms.** A gateway restarts or a network blip drops 500,000 sockets, and every client reconnects in the same second. The gateway warms slowly and refuses half of them, so they retry and make it worse. Clients must back off with jitter, and the gateway should admit connections at a fixed rate. This is the [Reconnect storm](/incidents/reconnect) incident, and [retry with backoff](/patterns/retry-with-backoff) is the fix.

**Hot conversations.** A group with a million members, or one live-event channel, sends all its traffic to one partition. Shard that conversation further by time bucket, put a cache in front of recent messages, and see [hot keys and hot shards](/patterns/hot-keys-and-hot-shards).

**Presence fan-out.** A user with 5,000 contacts who flaps online and offline sends 5,000 updates each time. Throttle changes, batch them, and fetch lazily. Presence is the first thing to degrade under load, and [load shedding](/patterns/load-shedding) should drop it before messages.

## Build it in Quorum

Two boards cover the two tiers of the answer. The first is the connection tier. A [Realtime Hub](/components/ws) sits behind an [API Gateway](/components/gw) next to an ordinary [App Server](/components/server) and a [Database](/components/database), and the Link's kinds send only realtime traffic to the Hub. The Hub runs on Node.js with Clustering, Presence and Reconnect backoff turned on. Look at how many connections the Hub holds, and what presence costs per message. Research [WebSockets](/research/websockets), then compare runtimes. The [Reconnect storm](/incidents/reconnect) incident then shows what a restart does without backoff, and [WebSockets tier for realtime](/patterns/websockets-tier-for-realtime) is the pattern.

::Design{id="realtime-hub"}

The second board is the message store, as Discord built it. The [Wide-column Store](/components/wide) is the message cluster, with three replicas per key and a quorum of two. The Realtime Hub is the gateway tier and a [Cache](/components/cache) holds hot channel state. Look at the quorum settings, since they are why a read sees the latest message even after a node fails. [Partition messages by channel](/patterns/partition-messages-by-channel) is the worked example.

::Design{id="discord-channel-partitions"}

The game does not model message ordering, sequence numbers, receipts, or offline push delivery. It teaches connection capacity, presence cost, reconnect behavior, and partitioning.

## Common questions

### Should a chat app use WebSockets or polling?

Use WebSockets, because a persistent connection delivers a message the moment it arrives and avoids thousands of empty requests. Long polling or server-sent events work as a fallback behind restrictive proxies. See [long polling and SSE](/patterns/long-polling-and-sse).

### How do you keep chat messages in order?

Partition by conversation ID and let one writer per partition assign increasing sequence numbers. The client sorts by that number, so out-of-order arrival on the network does not matter. You never need a global order.

### How do delivery receipts work in a chat system?

The server acks to the sender when it stores the message. The recipient's device acks when it receives it, and again when the user reads it, and each ack is a small message routed back to the sender. Messages without an ack are redelivered, so clients dedupe by ID.

### How do you build the online indicator?

Clients heartbeat to a session store, and the key expires if the heartbeats stop. Readers check the key when they open a conversation, instead of receiving every status change.
