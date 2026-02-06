/**
 * 実践: WebSocket を Effect で扱う - Step 5
 * 
 * 学ぶこと:
 * - 今までの知識を組み合わせて実際のWebSocket処理を書く
 * - Effect.acquireRelease でリソースのライフサイクル管理
 * - Effect.tryPromise で既存のコールバックAPIをラップ
 * - Service/Layer でテスタブルな設計にする
 * 
 * 実行: bun run examples/05-practical-websocket.ts
 */
import { Effect, Data, Context, Layer, Console, Scope } from "effect"
import WebSocket from "ws"

// ============================================
// 1. エラー型を定義
// ============================================

class WebSocketError extends Data.TaggedError("WebSocketError")<{
  message: string
  cause?: unknown
}> {}

class DecodeError extends Data.TaggedError("DecodeError")<{
  raw: unknown
  reason: string
}> {}

// ============================================
// 2. Config Service
// ============================================

class MexcConfig extends Context.Tag("MexcConfig")<
  MexcConfig,
  {
    readonly wsUrl: string
    readonly symbol: string
    readonly channel: string
  }
>() {}

const MexcConfigLive = Layer.succeed(MexcConfig, {
  wsUrl: "wss://wbs-api.mexc.com/ws",
  symbol: "BTCUSDT",
  channel: "spot@public.aggre.deals.v3.api.pb@100ms@BTCUSDT",
})

// ============================================
// 3. WebSocket接続をEffectでラップ
// ============================================

// WebSocket接続を作る（Promiseベースのコールバックをラップ）
const createConnection = (url: string): Effect.Effect<WebSocket, WebSocketError> =>
  Effect.tryPromise({
    try: () =>
      new Promise<WebSocket>((resolve, reject) => {
        const ws = new WebSocket(url)
        ws.on("open", () => resolve(ws))
        ws.on("error", (err) => reject(err))
      }),
    catch: (error) =>
      new WebSocketError({ message: "接続失敗", cause: error }),
  })

// ============================================
// 4. acquireRelease でリソース管理
// ============================================

// acquire: 接続を確立
// release: 接続を閉じる（必ず実行される）
const managedConnection = (url: string) =>
  Effect.acquireRelease(
    // acquire: WebSocket接続を作る
    createConnection(url).pipe(
      Effect.tap(() => Console.log("✓ WebSocket接続確立"))
    ),
    // release: 必ずクリーンアップ（try-finallyのfinally相当）
    (ws) =>
      Effect.sync(() => {
        ws.close()
        console.log("✓ WebSocket接続を閉じました")
      }),
  )

// ============================================
// 5. メッセージ受信をEffectでラップ
// ============================================

const receiveOneMessage = (ws: WebSocket): Effect.Effect<Buffer, WebSocketError> =>
  Effect.tryPromise({
    try: () =>
      new Promise<Buffer>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("タイムアウト")), 5000)
        ws.once("message", (data) => {
          clearTimeout(timeout)
          resolve(data as Buffer)
        })
        ws.once("error", (err) => {
          clearTimeout(timeout)
          reject(err)
        })
      }),
    catch: (error) =>
      new WebSocketError({ message: "受信失敗", cause: error }),
  })

// ============================================
// 6. 全体を組み立てる
// ============================================

const program = Effect.gen(function* () {
  const config = yield* MexcConfig

  yield* Console.log(`=== MEXC WebSocket Effect Demo ===`)
  yield* Console.log(`接続先: ${config.wsUrl}`)
  yield* Console.log(`チャンネル: ${config.channel}`)

  // Scoped: acquireReleaseを使うにはScope が必要
  const ws = yield* managedConnection(config.wsUrl)

  // サブスクリプション送信
  yield* Effect.sync(() => {
    ws.send(JSON.stringify({
      method: "SUBSCRIPTION",
      params: [config.channel],
    }))
  })
  yield* Console.log("✓ サブスクリプション送信")

  // 3件だけメッセージを受信してみる
  for (let i = 0; i < 3; i++) {
    const raw = yield* receiveOneMessage(ws)
    yield* Console.log(`メッセージ ${i + 1}: ${raw.length} bytes 受信`)
  }

  return "完了！"
})

// ============================================
// 7. 実行
// ============================================

// Effect.scoped: acquireRelease のスコープを提供
// Effect.provide: Layerを注入
const runnable = program.pipe(
  Effect.scoped,
  Effect.provide(MexcConfigLive),
  Effect.catchTag("WebSocketError", (e) => {
    console.error(`WebSocketエラー: ${e.message}`)
    return Effect.succeed("エラーで終了")
  }),
)

console.log("プログラム開始...")
const result = await Effect.runPromise(runnable)
console.log("結果:", result)

// ============================================
// まとめ: 元のindex.tsとの比較
// ============================================
//
// 【Before: 生のコールバック】
//   const ws = new WebSocket(url)
//   ws.on("open", () => { ... })
//   ws.on("message", (data) => { try { ... } catch { ... } })
//   ws.on("error", (err) => { ... })
//
// 【After: Effect】
//   ✓ エラーが型で管理される（NetworkError, DecodeError...）
//   ✓ リソースが自動的にクリーンアップされる（acquireRelease）
//   ✓ 設定がDIで注入される（Service/Layer）
//   ✓ テスト時にMockに差し替えられる
//   ✓ コードが上から下に読める（コールバック地獄なし）
