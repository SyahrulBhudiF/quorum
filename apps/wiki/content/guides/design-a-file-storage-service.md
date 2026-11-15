---
title: Design a file sync service like Dropbox
seoTitle: Design Dropbox: file sync system design guide
summary: Design a file sync service like Dropbox: chunking, object storage, a metadata database, sync and dedup, plus what Quorum teaches.
section: guides
order: 28
aliases: system design primer, file storage, dropbox, google drive, file sync, chunking, deduplication, object storage, system design interview
---

A file sync service splits every file into chunks, stores each chunk once in object storage under its hash, and keeps the file tree in a metadata database. Clients upload only chunks the server lacks and learn about changes through a notification channel. Bytes are cheap and the metadata database is the hard part.

This question is in the [System Design Primer](https://github.com/donnemartin/system-design-primer)'s [list of additional questions](https://github.com/donnemartin/system-design-primer#additional-system-design-interview-questions).

## Requirements

Functional:

- Upload, download, and delete files of up to several gigabytes.
- Sync a folder across a user's devices, and share files with other users.
- Keep version history, so an overwrite can be undone.

Non-functional:

- Durability above all. A lost file is the worst outcome.
- A small edit to a large file should not re-upload the whole file.
- A change shows up on other devices within seconds.
- Uploads resume after a dropped connection.

## Estimate the load

Assume 50 million users, 10 million active a day. Each user stores 10 GB on average and changes 20 files a day, at 1 MB average change.

- Storage: 50M x 10 GB = 500 PB. With 3x replication, or erasure coding at about 1.5x, that is 750 PB to 1.5 EB.
- Upload bandwidth: 10M x 20 x 1 MB = 200 TB a day, or 200 TB / 86,400 = about 2.3 GB a second.
- Metadata: a 4 MB chunk size gives 10 GB / 4 MB = 2,500 chunks per user, so 50M x 2,500 = 125 billion chunk records. At 100 bytes each, that is 12.5 TB. Metadata is small in bytes and large in rows.
- Sync checks: 10M users polling every 30 seconds is 330,000 requests a second unless you push changes.

## The design

### Chunking

The client splits a file into fixed chunks of about 4 MB, or content-defined chunks that move boundaries with the content. It hashes each chunk with SHA-256. Fixed chunks are simple, and content-defined chunks keep an insert at the top of a file from changing every following chunk.

### Block storage

Chunks go to [Object Storage](/components/storage), keyed by hash. Upload goes directly from the client with a pre-signed URL, so the App Server never carries the bytes. A chunk is immutable, which makes caching, replication, and [lifecycle rules](/patterns/object-storage-and-lifecycle-rules) trivial.

### Metadata database

A relational [Database](/components/database), sharded by user or folder, holds the file tree. Each file row has a version and an ordered list of chunk hashes. Metadata needs transactions, because a rename or a commit of a new version must be atomic. Read the [sharding](/patterns/sharding) pattern for how to split it.

### Dedup

Before uploading, the client asks which hashes the server already has, then sends only the missing ones. If two users upload the same installer, the second upload sends nothing. Dedup across users leaks whether a file exists, so some services dedup only within an account.

### Sync

Each device keeps a cursor, the last change ID it has seen. A notification service holds a connection per device, over [long polling or SSE](/patterns/long-polling-and-sse) or a WebSocket, and tells it that something changed. The device then calls an API for changes after its cursor and downloads the new chunks. Conflicts, where two devices edit the same file, produce a "conflicted copy" file and not a lost edit.

### Download path

Hot, shared files sit behind a [CDN](/components/cdn). Private files are fetched from Object Storage with short-lived signed URLs.

## Where it breaks

**Metadata hotspots.** One enterprise tenant with millions of files lands on one shard, and sync checks pile onto it. Shard by folder tree within big tenants, and cache listings. See [hot keys and hot shards](/patterns/hot-keys-and-hot-shards) and the [Hot shard](/incidents/hot-shard) incident.

**Slow uploads.** A large file on a poor connection holds a server connection for minutes. Upload chunks straight to storage, and send post-processing, such as virus scans and thumbnails, through a queue. See [slow work to a queue and workers](/patterns/slow-work-to-a-queue-and-workers).

**Storage cost.** Every version of every file piles up, and most are never read again. Move old versions to a cheaper class, expire them by policy, and reference-count chunks so deletion is safe. Cost grows as a runaway line item, as in the [Runaway bill](/incidents/runaway-bill) incident.

## Build it in Quorum

Two boards cover the storage half of the answer. The first is the move that comes before any chunking: take file bytes out of the Database. Look at the Database load and p99, which both fall once files leave its rows. It uses an [App Server](/components/server), a [Database](/components/database) and [Object Storage](/components/storage), and the only change from the board before it is where files go. [Stateless app servers](/patterns/stateless-app-servers) is the pattern.

::Design{id="files-in-storage"}

The second board is the real Dropbox shape, as Dropbox described it for its Magic Pocket store. Object Storage holds immutable blocks keyed by hash, and the Database is the block index, set to four shards on a hash key. The App Server hashes a block, writes it to storage, then writes the hash and its location to the index. Look at how small the index is next to the bytes, and at whether any shard runs hotter than the others. That is the "bytes are cheap, metadata is hard" point from the design above, and [index the blobs](/patterns/index-the-blobs) walks through it.

::Design{id="dropbox-block-index"}

Research [Object storage](/research/object-storage), then [Storage lifecycle rules](/research/lifecycle-rules), and set a lifecycle window and a storage class. Watch Burn as the store fills, and note that a request for an archived object fails as a timeout. Send uploads through a [Queue](/components/queue) and [Workers](/components/worker), and run the [Slow Uploads](/sandboxes/slow-uploads) Sandbox. For metadata growth, work through [Scale the database](/guides/scale-the-database).

The game has no chunking, hashing, dedup, or sync protocol. It models the store, its classes, the upload path, and the database that holds the rest.

## Common questions

### How does Dropbox store files?

It splits files into blocks of a few megabytes, stores each block once in a block store keyed by its hash, and keeps the file tree and block lists in a metadata database. Clients upload only blocks the server lacks.

### Why split files into chunks?

Chunks make uploads resumable, let a small edit upload one chunk and not the whole file, and enable dedup. They also parallelize transfers.

### How does file deduplication work?

Hash each chunk and look the hash up before uploading. If the store already has it, add a reference and skip the transfer. Delete a chunk only when its reference count reaches zero.

### How do other devices learn that a file changed?

Each device keeps a cursor and holds a connection to a notification service. A change sends a ping, and the device fetches changes after its cursor from the metadata service.
