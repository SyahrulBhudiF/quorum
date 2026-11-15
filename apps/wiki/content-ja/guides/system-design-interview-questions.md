---
title: システム設計の面接の質問
seoTitle: 解説付きのシステム設計の面接の質問
summary: よくあるシステム設計の面接の質問 19 問です。大半は System Design Primer から取り、それぞれに要件、負荷の見積もり、設計、壊れる箇所、ゲームで作るものが付きます。
section: guides
order: 19
aliases: system design interview, system design questions, system design interview prep, hld questions, high level design questions, design a, システム設計の面接, システム設計の質問, システム設計面接の対策, 高レベル設計の質問, 設計する
---

最初の 14 問は、最も広く使われている面接対策のリポジトリ、[System Design Primer](https://github.com/donnemartin/system-design-primer) から取っています。以下の各ページは、優れた候補者が答えるように 1 つの質問に答えます。要件を述べ、負荷を見積もり、設計を部品ごとに組み立て、最初に壊れる箇所を挙げます。そのあと Quorum のボードに何を置くかを示すので、失敗を暗記せずに自分の目で見られます。

| 質問                                                                                            | 学べる考え方                                                     |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| [URL 短縮サービスまたは Pastebin を設計する](/guides/design-a-url-shortener)                    | 一意なキーと、キャッシュから返す読み取り中心の負荷               |
| [ニュースフィードまたは Twitter のタイムラインを設計する](/guides/design-a-news-feed)           | 書き込み時のファンアウトと読み取り時のファンアウト               |
| [Web クローラーを設計する](/guides/design-a-web-crawler)                                        | キュー、礼儀、巨大なフロンティアの重複排除                       |
| [Mint.com を設計する](/guides/design-mint-com)                                                  | アカウントの同期と、メインのデータベースから外すバッチのレポート |
| [ソーシャルネットワークのデータ構造を設計する](/guides/design-a-social-network-graph)           | グラフのシャーディングと、人と人の間の経路探索                   |
| [検索エンジン向けのキーバリューストアを設計する](/guides/design-a-query-cache)                  | LRU、シャーディング、無効化によるクエリのキャッシュ              |
| [Amazon のカテゴリ別売上ランキングを設計する](/guides/design-a-sales-rank)                      | イベントを事前計算したトップリストへ集約する                     |
| [数百万ユーザーにスケールするシステムを設計する](/guides/design-a-system-for-millions-of-users) | 1 台からシャーディングされたデータまでの段階                     |
| [Dropbox のようなファイル同期サービスを設計する](/guides/design-a-file-storage-service)         | チャンク分割、メタデータ、同期                                   |
| [Google のような検索エンジンを設計する](/guides/design-a-search-engine)                         | クロール、転置インデックス、シャーディングされた配信             |
| [Redis や Dynamo のようなキーバリューストアを設計する](/guides/design-a-key-value-store)        | パーティショニング、レプリケーション、クォーラム                 |
| [Memcached のようなキャッシュシステムを設計する](/guides/design-a-cache-like-memcached)         | エビクション、ノード間のハッシュ、スタンピード                   |
| [WhatsApp のようなチャットアプリを設計する](/guides/design-a-chat-system)                       | 長く続く接続とメッセージの順序                                   |
| [Cloudflare のようなコンテンツ配信ネットワークを設計する](/guides/design-a-cdn)                 | エッジキャッシュ、ルーティング、オリジンシールド                 |
| [レートリミッターを設計する](/guides/design-a-rate-limiter)                                     | 多数のサーバーにまたがって公平にリクエストを数える               |
| [通知システムを設計する](/guides/design-a-notification-system)                                  | キュー、リトライ、冪等な配信                                     |
| [決済システムを設計する](/guides/design-a-payment-system)                                       | すべてがリトライされるときに二重請求しない                       |
| [動画ストリーミングサービスを設計する](/guides/design-a-video-streaming-service)                | アップロードのパイプライン、オブジェクトストレージ、CDN          |
| [チケット予約システムを設計する](/guides/design-a-ticket-booking-system)                        | フラッシュセールで希少な在庫を確保する                           |

知らない用語が質問に出てきたら、[システム設計の概念](/explanation/system-design-concepts)が、すべての考え方を解決する問題ごとにまとめています。何もないところから始めるなら、[遊んで学ぶシステム設計](/tutorials/learn-system-design)が順番を示します。

## よくある質問

### システム設計の面接の質問にどう取り組めばよいですか。

まず要件を尋ね、負荷を見積もり、動く中でいちばん単純な設計を描き、それから最初のボトルネックを見つけて直します。ここにある各ガイドはその順番に従います。面接官が見ているのが、その順番だからです。

### 面接官はシステム設計の答えの何を見ますか。

明確な要件、各選択を裏づける数字、トレードオフの正直な説明を見ます。技術の名前を挙げることよりも、それが何を犠牲にするか、いつ別のものを選ぶかを言えることのほうが重要です。

### ゲームは本当に面接対策の助けになりますか。

読むだけでは教えられない部分、つまり負荷が増えるにつれてシステムが壊れていく順番について助けになります。データベースが飽和し、次にキャッシュが読み取りを吸収し、そのあとキューが埋まるのを見ると、図では得られないボトルネックの感覚が身につきます。
