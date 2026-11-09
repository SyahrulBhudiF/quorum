---
title: Changelog
summary: What changed in Quorum over the last few days.
section: about
order: 3
aliases: changes, updates, release notes, patch notes, what is new
---

Quorum has no versions. It changes all the time, and this page lists the latest days, newest first, so you can see what moved since you last played. A page on this wiki can lag behind the game by a few days. Older days and every change are in the [full changelog](/about/changelog/all).

## Monday, 9 November 2026

21 changes.

- Format simulation files ([2696310](https://github.com/elianiva/quorum/commit/2696310e79f188fa0ec4354aed15ae744fbfc487))
- Fix rollback completion typing ([ea46e79](https://github.com/elianiva/quorum/commit/ea46e790ef6f981a46e739da64ff04d00101fbd6))
- Reset cache and CDN to a cold path on config changes ([8258655](https://github.com/elianiva/quorum/commit/825865597120f2f36a64dc120add94bb50708732))
- Share API Gateway rate limit state across all gateways ([8a5b903](https://github.com/elianiva/quorum/commit/8a5b90305535ed0c6ceec443cead720a7de9fcb0))
- Make rollback take deploy time instead of ending at once ([067c323](https://github.com/elianiva/quorum/commit/067c323e4f2897262f33a306dbc1c1c1c004a129))
- [16 more](/about/changelog/all#monday-9-november-2026)

## Sunday, 8 November 2026

38 changes.

- Give Postgres and MySQL distinct engine tradeoffs ([72070b8](https://github.com/elianiva/quorum/commit/72070b8f1e36e5acf325de795814ce9074aca6d3))
- Read agents from a remote MCP server ([9ebd70f](https://github.com/elianiva/quorum/commit/9ebd70f03ec2166ca8fb90b27b87d06c620589ad))
- Search the wiki with MiniSearch ([70a0d06](https://github.com/elianiva/quorum/commit/70a0d067e3dcdf957d7accdbd642f3f9f35fa16d))
- Keep the two moved Challenges on the mix they were tuned on ([bdf0dd1](https://github.com/elianiva/quorum/commit/bdf0dd1f93ef2a9f2c03466d66029e614360cc22))
- Explain every Node option on its component page ([e4e2f2b](https://github.com/elianiva/quorum/commit/e4e2f2bbd874e176f1109b6e84f244e78db04e8c))
- [33 more](/about/changelog/all#sunday-8-november-2026)

## Saturday, 7 November 2026

44 changes.

- Add the Patterns section to the wiki ([29835af](https://github.com/elianiva/quorum/commit/29835af7427c93ef51e0b5b963dfb1bff150e768))
- Reserve the warning sound for alarms, and let the player set the volume ([5f9446e](https://github.com/elianiva/quorum/commit/5f9446e0f830aa9dd0038ff969a18fa2d890432f))
- Fix the bot's replica comment ([dc6c6a4](https://github.com/elianiva/quorum/commit/dc6c6a44473de6422edae8e3372f5c61af2132f0))
- Pass pooled connections through an L4 Load Balancer ([79317a5](https://github.com/elianiva/quorum/commit/79317a55a65ebb6607a363269c4ffab609300de6))
- Let only an L4 Load Balancer pass on Database queries ([2196ece](https://github.com/elianiva/quorum/commit/2196eceb5acc5206bfee17bc4a227b67718d2fdd))
- [39 more](/about/changelog/all#saturday-7-november-2026)

## Friday, 6 November 2026

53 changes.

- Split the game update into one module per subject ([bc2efdb](https://github.com/elianiva/quorum/commit/bc2efdba392048c6c173626d2b68306287a36165))
- Type Mail, toasts and thread endings; remove the runtime dictionaries ([49d2845](https://github.com/elianiva/quorum/commit/49d28459562bf18e984042c54977dd53c7fa4942))
- Type composed copy and units, and drop the runtime lookup from views ([9695d38](https://github.com/elianiva/quorum/commit/9695d38aefb3acb07241e3dc4293efae1ebda4a4))
- Patch oxlint in orb setup so lint never falls back to tsgolint ([30d4757](https://github.com/elianiva/quorum/commit/30d4757d9d1a73c64f68e99219273e60c4dc11f2))
- Add the Amp feedback widget to the website ([36d2a57](https://github.com/elianiva/quorum/commit/36d2a5792dbf7ffcf162ba3b85abe649a3bd18cb))
- [48 more](/about/changelog/all#friday-6-november-2026)

## Thursday, 5 November 2026

42 changes.

- Build the runtime, framework and data-tier mechanics the design names and retire the remaining gap notes: libuv pool, recycled workers, runtime incidents, framework effects, durability, gateway options, GPU models, consistent hash, dominance test ([588eaf6](https://github.com/elianiva/quorum/commit/588eaf6e294a2a64c5eeffb2453de2ddabf7a708))
- Build the Observability, Incidents, Exit, Interface and Mail gaps and retire the gap lists: Service filter, alert rules, Era marks, slow start, Autopilot, Head start, Shared tenancy, Venture rules, spam filter, backdoor, vendor demos, second provider ([4fd2a3a](https://github.com/elianiva/quorum/commit/4fd2a3ae7d1d10fd250ea644303f7e23e5242134))
- Build the Components and Data tier gaps: sticky sessions, CDN purge and key, shard keys, sync replicas, Search and Object Storage options, stampede options, data volume time, per-request prices ([003fd59](https://github.com/elianiva/quorum/commit/003fd59b5f122da32d9c4418d841e49f4c425d91))
- Build the Features and Team gaps: market cap, engineering tasks, auth and engine moves, SOC 2 staffing ([88e315b](https://github.com/elianiva/quorum/commit/88e315b95f4765f27c67f1d74341cbbec54ee297))
- Move the simulation tests and fixtures out of src ([3c2b2b8](https://github.com/elianiva/quorum/commit/3c2b2b875733d07e053a3e9516234c9632219ff9))
- [37 more](/about/changelog/all#thursday-5-november-2026)

## Wednesday, 4 November 2026

58 changes.

- Implement pricing, achievements, mail actions, and Dashboard rows ([5c0c0e7](https://github.com/elianiva/quorum/commit/5c0c0e7cea16c9a2f192682a414467e39c755c31))
- Buy ten sizes at once, or up to the largest ([e8870b3](https://github.com/elianiva/quorum/commit/e8870b3d982413f4b2e66994935485e5073567eb))
- Add the Cost panel, splitting Burn into its lines ([b8cb017](https://github.com/elianiva/quorum/commit/b8cb01792bba1897b5de59c5258e7b2c7de4a7a2))
- Name the Challenge ruleset and drop the unused design indexes ([b706e4e](https://github.com/elianiva/quorum/commit/b706e4e70c4fb9b89f68f144c22bad30e40cbeb9))
- Move the design document into the wiki ([8359e44](https://github.com/elianiva/quorum/commit/8359e44c17b160a9396d407963c50457e6fd3dd6))
- [53 more](/about/changelog/all#wednesday-4-november-2026)

## Tuesday, 3 November 2026

61 changes.

- Group the board's clock and disclosure state into submodels ([80fe685](https://github.com/elianiva/quorum/commit/80fe68510b19a6c525ccca9fee2c7e0983758dc9))
- Split the Model into the session and the Board being played ([c2fd5ea](https://github.com/elianiva/quorum/commit/c2fd5ea75da2349ac93655f3be563ac05347c55a))
- Group the Dashboard panel's state into one submodel ([7987501](https://github.com/elianiva/quorum/commit/7987501a545042883ce327626369bb1fedf9cebe))
- Move the Inbox into its own submodel ([1c42fe5](https://github.com/elianiva/quorum/commit/1c42fe5325f96ed9eaec1c8a31f8b0ddcb6dfb7a))
- Group the Glossary panel's state into one submodel ([251f80d](https://github.com/elianiva/quorum/commit/251f80d6fa93f8062fad27357dc8feed9e0d84ba))
- [56 more](/about/changelog/all#tuesday-3-november-2026)
