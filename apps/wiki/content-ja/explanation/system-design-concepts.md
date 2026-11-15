---
title: システム設計の概念
seoTitle: 例で解説するシステム設計の概念
summary: システム設計の質問の大半の背景にある概念を、それぞれが解決する問題ごとにまとめました。1 つずつにページがあり、ゲームで試す方法も付いています。
section: explanation
order: 20
aliases: system design concepts, system design basics, system design cheat sheet, distributed systems concepts, scalability concepts, system design fundamentals, システム設計の概念, システム設計の基礎, システム設計チートシート, 分散システムの概念, スケーラビリティの概念
---

システム設計の質問の大半は 50 ほどの考え方に行き着き、それぞれが特定の問題に答えます。トラフィックが多すぎる、データが 1 台に収まらない、依存先が失敗する、数字が実態を隠す、といった問題です。このページは、それらを問題ごとにまとめます。各項目は、それを説明するページへのリンクで、その多くには、実際のトラフィックで動く様子を見られるコンポーネントまたはサンドボックスが Quorum にあります。

## 1 台のサーバーでは足りないとき

まず、アプリの層をコピーできるものにします。[ステートレスなアプリサーバー](/patterns/stateless-app-servers)はメモリにセッションを持たないので、どのコピーでもどのリクエストにも答えられます。次に、[ロードバランサーの後ろの複数のアプリサーバー](/patterns/several-app-servers-behind-a-load-balancer)が仕事を分けます。[垂直スケーリングと水平スケーリング](/patterns/vertical-and-horizontal-scaling)のどちらを選ぶかはコストの問いで、[まずスケールアップ](/patterns/scale-up-first)は、大きな 1 台のほうが、人が思うより長く安い答えであることが多いと論じます。

- [ロードバランシングのアルゴリズム](/patterns/load-balancing-algorithms): ラウンドロビン、最小接続数、そして 1 台のサーバーが遅いときにそれぞれがどうなるか。
- [レイヤー 4 とレイヤー 7 のロードバランシング](/patterns/layer-4-and-layer-7-load-balancing): 接続で振り分けるか、リクエストの中身で振り分けるか。
- [スティッキーセッション](/patterns/sticky-sessions): ユーザーを 1 台のサーバーに固定すること、そしてそれがスケールダウンを難しくする理由。
- [コンピュート層のオートスケール](/patterns/autoscale-the-compute-tier): 負荷が上がるとコピーを足すこと、そして起動が遅いと間に合わない理由。

## 同じデータを何度も読む

キャッシュは、繰り返される読み取りにメモリから答えるので、データベースが答えなくて済みます。[キャッシュアサイド](/patterns/cache-aside)が既定で、[ライトスルーとライトビハインド](/patterns/write-through-and-write-behind)は、書き込みがいつデータベースに届くかを変えます。ホットなキーが期限切れになると、すべての読み手が一斉にデータベースへ向かいかねませんが、[キャッシュスタンピード対策](/patterns/cache-stampede-protection)がそれを防ぎます。

- [CDN のプッシュとプル](/patterns/cdn-push-and-pull): 読み手の近くのサーバーからファイルを返す。
- [オブジェクトストレージと CDN 上の静的ファイル](/patterns/static-files-on-object-storage-and-a-cdn): 画像やダウンロードをアプリサーバーから完全に外す。
- [キャッシュのウォーミングと階層キャッシュ](/patterns/cache-warming-and-tiered-caching): 再起動後に温まった状態で始めることと、キャッシュを重ねること。
- [事前計算](/patterns/precomputation): 重い処理を、誰かが頼む前に済ませる。

## データベースが限界のとき

読み取りと書き込みはデータベースへの当たり方が違うので、スケールの仕方も違います。[リードレプリカ](/patterns/read-replicas)は、読み取りだけに答えるサーバーへデータをコピーし、[レプリケーション戦略](/patterns/replication-strategies)は、その途中で書き込みに何が起きるかを説明します。書き込みが限界なら、[シャーディング](/patterns/sharding)がデータをサーバーに分割し、[コンシステントハッシュ](/patterns/consistent-hashing)は、サーバーの集合が変わってもほとんどのキーを動かさずに、どのサーバーがキーを持つかを決めます。

- [ホットキーとホットシャード](/patterns/hot-keys-and-hot-shards): トラフィックの大半を受ける 1 つのキーが、均等な分割を台無しにする。
- [コネクションプーリング](/patterns/connection-pooling): データベースが受け付ける接続は少なく、多数のアプリサーバーがそれを使い切りうる。
- [マテリアライズドビューと非正規化](/patterns/materialized-views-and-denormalization): 読み取りのたびに計算せず、答えを保存する。
- [ドキュメントストアとワイドカラムストア](/patterns/document-and-wide-column-stores): データの形が変わるとき、または書き込みが 1 台を超えるとき。
- [全文検索と転置インデックス](/patterns/full-text-search-and-inverted-index): 検索エンジンがデータベースの隣に置かれる理由。
- [OLTP と OLAP の分離](/patterns/oltp-and-olap-split): レポートを、注文を受けるデータベースから外す。

## データのコピーが食い違うとき

データが複数の場所にあると、コピーはしばらく食い違いえます。設計は、それがどのくらいまで許されるかを言わなければなりません。[CAP と PACELC](/patterns/cap-and-pacelc) はそのトレードオフを述べ、[一貫性モデル](/patterns/consistency-models)は、厳密なものから結果整合までの選択肢を並べます。[クォーラムの読み取りと書き込み](/patterns/quorum-reads-and-writes)では、ストアがリクエストごとにその線上の位置を選べます。

- [コンセンサスとリーダー選出](/patterns/consensus-and-leader-election): サーバーの集まりが 1 つの値または 1 人のリーダーに合意する仕組み。
- [自分の書き込みを読む](/patterns/read-your-writes): ユーザーが保存したばかりのものを必ず見られるようにする。
- [2 フェーズコミット](/patterns/two-phase-commit)と[サガ](/patterns/saga): 複数の場所でデータを変える 2 つの方法と、手順が失敗したときにそれぞれが払う代償。
- [CRDT](/patterns/crdts): 調整役なしでマージできるデータ型。

## いま起きなくてよい仕事

キューがあると、速い生産者が遅い消費者に仕事を渡せます。[遅い仕事をキューとワーカーへ](/patterns/slow-work-to-a-queue-and-workers)が基本の動きで、[キューによる負荷の平準化](/patterns/queue-load-leveling)は、それがスパイクをならす理由を示します。[パブリッシュ・サブスクライブ](/patterns/publish-subscribe)は 1 つのイベントを多数の消費者へ送り、[競合コンシューマー](/patterns/competing-consumers)は 1 つのキューを多数のワーカーで分け合います。

- [デッドレターキュー](/patterns/dead-letter-queue): 何度も失敗したメッセージの行き先。
- [冪等キー](/patterns/idempotency-keys): リトライされたリクエストを、繰り返しても安全にする。
- [トランザクショナルアウトボックス](/patterns/transactional-outbox): 変更を保存して知らせる、そのどちらも失わずに行う。
- [変更データキャプチャ](/patterns/change-data-capture): データベースの変更をイベントに変える。
- [書き込み時と読み取り時のファンアウト](/patterns/fan-out-on-write-and-on-read): 投稿されたときに処理するか、読まれたときに処理するか。
- [ロングポーリングと SSE](/patterns/long-polling-and-sse)と [WebSocket](/patterns/websockets-tier-for-realtime): クライアントへ更新を押し出す。

## 何かが失敗するとき

遅い依存先は、止まった依存先より危険です。呼び出し側が待って溜まるからです。[タイムアウト](/patterns/timeouts)は待ちに上限を設けます。[バックオフ付きリトライ](/patterns/retry-with-backoff)は短い障害から回復し、[サーキットブレーカー](/patterns/circuit-breaker)は、止まっているサービスへリトライが殺到するのを防ぎます。[バルクヘッド](/patterns/bulkhead)は、失敗している 1 つの依存先がすべてのスレッドを使うのを防ぎます。

- [ロードシェディング](/patterns/load-shedding): 最も価値の低い仕事を捨てて、残りを速く保つ。
- [レート制限](/patterns/rate-limiting): 1 つのクライアントが送れる量に上限を設ける。
- [バックプレッシャー](/patterns/backpressure): 生産者に速度を落とすよう伝える。
- [グレースフルデグラデーション](/patterns/graceful-degradation): ページ全体を失敗させず、1 つの機能を切る。
- [ヘッジリクエスト](/patterns/hedged-requests): 最初のリクエストが遅いときに 2 つ目を送る。
- [ヘルスチェックとフェイルオーバー](/patterns/health-checks-and-failover): 止まったサーバーに気づき、トラフィックを別へ送る。
- [カオスエンジニアリング](/patterns/chaos-engineering): 先に知るために、わざと壊す。

## システムを測る

読み違えたものは直せません。[平均ではなくパーセンタイル](/patterns/percentiles-not-averages)は、平均が最も遅いユーザーを隠す様子を示し、[テールレイテンシ](/patterns/tail-latency)は、ページが多くの呼び出しをするとき、最も遅いリクエストが支配的になる理由を説明します。[レイテンシとスループット](/patterns/latency-vs-throughput)と[リトルの法則](/patterns/littles-law)は、その 2 つの数字をつなぎます。

- [可用性とナイン](/patterns/availability-and-nines): 99.9 パーセントと 99.99 パーセントが、停止時間の分数で何を意味するか。
- [SLO とエラーバジェット](/patterns/slos-and-error-budgets): どこまでの失敗が許されるかを合意する。
- [ゴールデンシグナル、RED、USE](/patterns/golden-signals-red-and-use): まず見る価値のある、少数の指標。
- [RPO と RTO](/patterns/rpo-and-rto): 災害でどれだけのデータを失いうるか、復旧にどれだけかかってよいか。

## よくある質問

### 最初に学ぶべき最も重要なシステム設計の概念は何ですか。

ロードバランシング、キャッシュ、レプリケーション、シャーディング、キューを最初に学びます。ほぼすべての面接の質問が、少なくとも 3 つを使うからです。次にタイムアウト、リトライ、パーセンタイルを足します。負荷のもとでシステムが失敗する理由と、それに気づく方法を説明してくれるからです。

### 面接の相手がいなくてもシステム設計を練習するには。

システムを作り、トラフィックを流し、どの部分が最初に失敗するかを見ます。Quorum はそれをボード上で行います。コンポーネントを置くとシミュレーションがそれらを通してリクエストを送り、直すたびにボトルネックが別の場所へ移るので、現実のシステムが壊れる順番を学べます。[最初のボトルネックのチュートリアル](/tutorials/first-bottleneck)が短い入り口です。

### システム設計は面接のためだけのものですか。

いいえ。同じ考え方が、実際のサービスがローンチの日やフラッシュセールを乗り切れるかを決め、[インシデント](/incidents)のページは、それぞれが失敗するときにどう見えるかを示します。面接は同じ推論を、短い時間と少ないデータで試します。
