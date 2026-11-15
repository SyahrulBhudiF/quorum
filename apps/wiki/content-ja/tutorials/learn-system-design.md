---
title: 遊んで学ぶシステム設計
seoTitle: 無料のゲームで遊んで学ぶシステム設計
summary: 最初のサーバーから、データのスケール、障害への対処、面接の質問への答え方まで進む、読む順番と遊ぶ順番です。
section: tutorials
order: 6
aliases: learn system design, system design course, system design roadmap, system design for beginners, system design study plan, learn scalability, システム設計を学ぶ, システム設計講座, システム設計ロードマップ, 初心者向けシステム設計, システム設計の学習計画, スケーラビリティを学ぶ
---

システム設計をいちばん早く学べるのは、設計がトラフィックで壊れるのを見て、それを直すときです。そのため、この道筋は遊ぶことと読むことを交互に挟みます。各ステージは Quorum で数分遊ぶところから始まり、いま見たことを説明するページへ案内します。どのステージで止めても、半分ではなく 1 つの完結した考え方が手に入ります。

## ステージ 1: サーバー 1 台とデータベース 1 台

[最初の会社](/tutorials/first-company)を遊び、そのあとで[最初のボトルネック](/tutorials/first-bottleneck)を遊びます。1 台のサーバーが限界に達するのを見て、どのノードが満杯かを教えるカードの読み方を学びます。[キャパシティ、使用率、キュー](/explanation/queues)を読むと、ノードが満杯になるずっと前から遅くなる理由がわかります。[レイテンシとパーセンタイル](/explanation/latency)を読むと、平均が最も遅いユーザーを隠す理由がわかります。

## ステージ 2: サーバーを増やし、次にキャッシュ

[ロードバランサー](/components/lb)の後ろに 2 台目のサーバーを足し、[データベース](/components/database)の前に[キャッシュ](/components/cache)を置きます。[ステートレスなアプリサーバー](/patterns/stateless-app-servers)、[キャッシュアサイド](/patterns/cache-aside)、[垂直スケーリングと水平スケーリング](/patterns/vertical-and-horizontal-scaling)を読みます。ガイド[トラフィックの急増を乗り切る](/guides/survive-a-traffic-spike)は、同じ考え方を圧力のもとで見せます。

## ステージ 3: データベースが限界のとき

[リードレプリカ](/components/replica)と[コネクションプーラー](/components/pooler)を足します。[リードレプリカ](/patterns/read-replicas)、[レプリケーション戦略](/patterns/replication-strategies)、[シャーディング](/patterns/sharding)を読み、そのあとキーが自分のサーバーを見つける仕組みを知るために[コンシステントハッシュ](/patterns/consistent-hashing)を読みます。[データベースをスケールする](/guides/scale-the-database)は、打つ手の順番を順に見せます。

## ステージ 4: 待てる仕事

遅いジョブの後ろに[キュー](/components/queue)と[ワーカー](/components/worker)を置きます。[キューによる負荷の平準化](/patterns/queue-load-leveling)、[パブリッシュ・サブスクライブ](/patterns/publish-subscribe)、[冪等キー](/patterns/idempotency-keys)を読みます。リトライするキューには、繰り返しても安全なリクエストが必要だからです。

## ステージ 5: 障害

[最初のインシデント](/tutorials/first-incident)を遊んでから、[インシデントの仕組み](/explanation/incidents)と[エラーとリトライ](/explanation/errors-and-retries)を読みます。[リトライストームのガイド](/guides/stop-a-retry-storm)は、リトライのポリシーが短い遅れを停止に変える様子を見せます。そのあと[タイムアウト](/patterns/timeouts)、[サーキットブレーカー](/patterns/circuit-breaker)、[ロードシェディング](/patterns/load-shedding)を読みます。

## ステージ 6: 言葉にする

全体の地図として[システム設計の概念](/explanation/system-design-concepts)を読み、そのあと[システム設計の面接の質問](/guides/system-design-interview-questions)に挑みます。各質問は、要件、負荷の見積もり、設計、壊れる箇所を示し、ゲームで何を作れば見られるかを教えます。

## よくある質問

### システム設計を学ぶのにコードを書ける必要はありますか。

いいえ。システム設計はどの部品を使い、どう組み合わせるかの話なので、サーバー、データベース、リクエストが何かを知っていれば十分です。残りは、自分が置いた部品の間をリクエストが流れる様子を見せることで Quorum が教えます。

### システム設計を学ぶのにどのくらいかかりますか。

中心になる考え方は、集中して数週間に収まります。各ステージを 20 分から 30 分遊び、リンク先のページを読めば、Web サービスのスケールについて会話できます。後半のステージは、シニアの面接が求める深さを与えます。

### Quorum は無料ですか。

はい。アカウントもダウンロードも要らず、ブラウザで動き、ソースコードは公開されています。
