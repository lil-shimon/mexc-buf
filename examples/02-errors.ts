/**
 * Effect エラーハンドリング - Step 2
 * 
 * 学ぶこと:
 * - Data.TaggedError で型付きエラーを定義
 * - Effect.tryPromise で外部処理をラップ
 * - catchTag / catchAll でエラーを処理
 * - エラー型がコンパイル時にチェックされる
 * 
 * 実行: bun run examples/02-errors.ts
 */
import { Effect, Data, Console } from "effect"

// ============================================
// 1. 型付きエラーを定義する
// ============================================

// TaggedError = _tag プロパティ付きのエラークラス
class NetworkError extends Data.TaggedError("NetworkError")<{
  url: string
  status: number
}> {}

class ParseError extends Data.TaggedError("ParseError")<{
  input: string
  reason: string
}> {}

// ============================================
// 2. エラーを投げるEffectを作る
// ============================================

// ネットワークリクエストのシミュレーション
const fetchPrice = (symbol: string): Effect.Effect<number, NetworkError> =>
  // 50%の確率で失敗する
  Math.random() > 0.5
    ? Effect.succeed(50000.0)
    : Effect.fail(new NetworkError({ url: `/api/${symbol}`, status: 503 }))

// JSONパースのシミュレーション
const parseResponse = (raw: string): Effect.Effect<{ price: number }, ParseError> =>
  raw.includes("price")
    ? Effect.succeed({ price: 50000 })
    : Effect.fail(new ParseError({ input: raw, reason: "price field missing" }))

// ============================================
// 3. エラーをハンドリングする
// ============================================

console.log("--- catchTag: 特定のエラーだけ処理 ---")

const program1 = fetchPrice("BTCUSDT").pipe(
  // NetworkError だけをキャッチ（他のエラーは素通り）
  Effect.catchTag("NetworkError", (e) =>
    // フォールバック値を返す
    Effect.succeed(-1)
  ),
)
// 型: Effect<number, never, never>
// ↑ エラーが never = 全てのエラーが処理済み！

const result1 = Effect.runSync(program1)
console.log("結果:", result1) // 50000 or -1

// ============================================
// 4. 複数エラーの合成
// ============================================

console.log("\n--- 複数エラーの合成 ---")

const program2 = Effect.gen(function* () {
  // fetchPrice は NetworkError を返しうる
  const price = yield* fetchPrice("BTCUSDT")
  
  // parseResponse は ParseError を返しうる
  const parsed = yield* parseResponse(`{"price": ${price}}`)
  
  return parsed
})
// 型: Effect<{ price: number }, NetworkError | ParseError, never>
// ↑ 両方のエラーが自動的にユニオン型になる！

const program2Handled = program2.pipe(
  // それぞれのエラーを個別に処理
  Effect.catchTag("NetworkError", (e) => {
    console.log(`ネットワークエラー: ${e.url} (${e.status})`)
    return Effect.succeed({ price: 0 })
  }),
  Effect.catchTag("ParseError", (e) => {
    console.log(`パースエラー: ${e.reason}`)
    return Effect.succeed({ price: 0 })
  }),
)

const result2 = Effect.runSync(program2Handled)
console.log("結果:", result2)

// ============================================
// 5. tryPromise - 既存のPromiseをラップ
// ============================================

console.log("\n--- tryPromise ---")

// あなたのプロジェクトでWebSocket接続をラップする時のイメージ
const connectWebSocket = (url: string) =>
  Effect.tryPromise({
    try: () =>
      // 実際のPromiseベースの処理
      Promise.resolve({ connected: true, url }),
    catch: (error) =>
      // エラーを型付きエラーに変換
      new NetworkError({ url, status: 0 }),
  })

const result3 = await Effect.runPromise(connectWebSocket("wss://example.com"))
console.log("接続結果:", result3)

// ============================================
// 練習問題
// ============================================
// 1. DecodeError を定義して、Protobufデコード失敗を表現してみよう
// 2. fetchPrice → parseResponse を pipe で繋いで、全エラーをハンドリングしてみよう
