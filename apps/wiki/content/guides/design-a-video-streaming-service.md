---
title: Design a video streaming service
seoTitle: Design a video streaming service: interview guide
summary: Design a video streaming service for a system design interview: upload, transcoding queue, object storage, CDN, and adaptive bitrate, and what Quorum teaches.
section: guides
order: 27
aliases: video streaming, youtube, netflix, transcoding, cdn, adaptive bitrate, hls, system design interview
---

A video service has two paths. Uploads go to object storage, then a queue feeds a fleet of transcoding workers that cut each video into short segments at several quality levels. Viewers never touch your servers for video: a CDN serves the segments, and the player switches quality as bandwidth changes.

## Requirements

Functional:

- Creators upload videos of up to several gigabytes.
- Viewers play a video within a couple of seconds on any device and connection.
- Search and metadata, such as title and view count, work alongside playback.

Non-functional:

- Playback starts in under 2 seconds with no rebuffering on a normal connection.
- Uploads survive a dropped connection.
- Storage is durable. A lost original cannot be recreated.
- Egress is the largest cost, so the design must keep traffic off the origin.

## Estimate the load

Assume 100 million daily viewers, each watching 5 videos of 5 minutes, and 500,000 uploads a day at 5 minutes each.

- Egress: 100M x 5 x 5 min = 2.5 billion minutes a day. At an average of 3 Mbps, that is 3 Mbps x 60 s / 8 = 22.5 MB per minute, so 2.5B x 22.5 MB = 56 PB a day. Peak concurrent viewers are about 2.5B / 1,440 x 3, roughly 5 million streams, or 15 Tbps.
- Upload storage: a 5-minute original at 1080p is about 300 MB, so 500,000 x 300 MB = 150 TB a day. Transcoded renditions add about 2x.
- Transcoding: 500,000 videos a day is about 6 a second, and each takes several CPU minutes per rendition.

No origin can serve 15 Tbps, so the CDN is the design. The write side is small by comparison.

## The design

### Upload

The client splits the file into chunks and uploads each directly to [Object Storage](/components/storage) with a pre-signed URL. The App Server only issues the URL and records metadata. Direct upload keeps a multi-gigabyte file from holding an App Server slot, and chunks let a failed upload resume. See [claim check](/patterns/claim-check).

### Transcoding queue

When the upload completes, a message goes to a [Queue](/components/queue). [Workers](/components/worker) pull a job, split the video into segments of a few seconds, and encode each segment at several resolutions and bitrates, for example 240p to 4K. Segments encode in parallel, so a two-hour film finishes in minutes. This is [slow work to a queue and workers](/patterns/slow-work-to-a-queue-and-workers). Jobs can run twice, so write outputs under deterministic keys.

### Storage layout

Originals stay in Object Storage in a cold class. Rendition segments and a manifest file per video sit beside them. A [metadata database](/components/database) holds title, owner, status, and the manifest location. [Lifecycle rules](/patterns/object-storage-and-lifecycle-rules) move old, unpopular videos to cheaper classes.

### CDN

The CDN sits first in the viewing path. It caches segments at edge locations near the viewer and falls back to a regional cache, then to Object Storage. Video is highly cacheable and popularity is skewed, so the hit ratio is very high. Read [static files on object storage and a CDN](/patterns/static-files-on-object-storage-and-a-cdn) and [CDN push and pull](/patterns/cdn-push-and-pull).

### Adaptive bitrate

The manifest, in HLS or DASH format, lists every rendition and its segments. The player downloads a segment, measures how long it took, and picks the next segment's quality accordingly. A throttled phone drops to 360p instead of stalling.

## Where it breaks

**Premiere spike.** A hit release sends millions of viewers to the same segments in the same minute. A cold edge misses on all of them, and the misses stack up on the origin. Pre-warm the CDN, add a mid-tier cache that collapses duplicate misses, and shed load before the origin falls over. The game incident is [Premiere spike](/incidents/premiere-spike), and [cache warming and tiered caching](/patterns/cache-warming-and-tiered-caching) is the fix.

**Transcoding backlog.** A burst of uploads leaves the queue growing for hours, and creators wait to publish. Scale workers on queue depth, and put long jobs on cheap interruptible capacity such as [spot instances](/glossary/spot-instance). See [queue load leveling](/patterns/queue-load-leveling) and [autoscaling](/patterns/autoscale-the-compute-tier).

**Poison jobs.** A corrupt file crashes the encoder every time, and an unlimited retry blocks the queue. Cap attempts and park the job in a [dead letter queue](/patterns/dead-letter-queue). The game version is [Poison message](/incidents/poison).

## Build it in Quorum

Three boards cover the viewing path and the storage under it. The first takes bytes off the Database. An [App Server](/components/server) sends files to [Object Storage](/components/storage), and the [Database](/components/database) keeps rows only. Look at the Database's load bar and p99, which fall once files leave its rows. Research [Object storage](/research/object-storage) to place it. This is the upload and originals half of the design, and the board is [stateless app servers](/patterns/stateless-app-servers) at work.

::Design{id="files-in-storage"}

The second board puts a [CDN](/components/cdn) in front of the App Server, pulling from the origin on a miss. It has a long TTL and purge on deploy, so the edge refills after a release. Look at how much traffic the App Server and Database see compared with a run that has no CDN. Research [Content delivery](/research/cdn) first. See [CDN push and pull](/patterns/cdn-push-and-pull), and note that the game models pull only.

::Design{id="cdn-pull"}

The third board is how Netflix ran it. The CDN stands for Open Connect, a cache close to the viewer that answers media without the origin. The App Servers are the control plane, a [Cache](/components/cache) holds personal data, the Database is the source of truth, and Object Storage holds the video the edge has not cached. Look at which Component answers the bulk of requests. [Own the edge](/patterns/own-the-edge) tells the story.

::Design{id="netflix-own-cdn"}

Research [Tiered caching](/research/tiered-caching) to raise how much video the edge answers, and run the [Premiere spike](/incidents/premiere-spike) incident against it. For uploads, link the App Server to a [Queue](/components/queue) and a [Worker](/components/worker), and link the Worker to Object Storage. The [Slow Uploads](/sandboxes/slow-uploads) Sandbox teaches that path.

The game has no transcoding step, renditions, or manifests, and a Worker stands for any background job and not for an encoder. Adaptive bitrate is not modeled. The upload path, the storage class, and the CDN hit ratio are the parts you can build and measure.

## Common questions

### How does YouTube store and serve videos?

Originals and transcoded renditions sit in distributed object storage, with metadata in a separate database. Playback comes from CDN edge caches, and only misses reach storage.

### What is adaptive bitrate streaming?

The video is encoded at several qualities and cut into segments of a few seconds. A manifest lists them, and the player picks each next segment's quality from the bandwidth it just measured. Playback keeps going at lower quality instead of freezing.

### Why use a queue for video transcoding?

Transcoding takes minutes of CPU per video and uploads arrive in bursts, so the web tier cannot do it inline. A queue lets uploads return at once while workers drain jobs at their own pace, and retries are safe.

### How do you stop a viral video from overloading the origin?

Cache segments at the edge, put a shared mid-tier cache between edges and storage so duplicate misses collapse into one request, and warm the cache for known releases.
