/**
 * Effect.gen - Step 3
 *
 * 学ぶこと:
 * - Effect.gen = async/await のEffect版
 * - yield* = await と同じ感覚
 * - 制御フロー（if/for/while）も普通に使える
 * - エラー型が自動的に集約される
 *
 * 実行: bun run examples/03-gen.ts
 */
import { Effect, Data, Console } from "effect";

// エラー定義
class ApiError extends Data.TaggedError("ApiError")<{ message: string }> { }
class ValidationError extends Data.TaggedError("ValidationError")<{
  field: string;
}> { }

// ============================================
// 1. Effect.gen の基本
// ============================================

// async/await スタイル
// const fetchUser = async (id: number) => {
//   const response = await fetch(`/users/${id}`)
//   const data = await response.json()
//   return data
// }

// Effect.gen スタイル（ほぼ同じ！）
const fetchUser = (id: number) =>
  Effect.gen(function*() {
    // yield* = await と思えばOK
    yield* Console.log(`ユーザー ${id} を取得中...`);

    // 実際のAPIコールの代わり
    const user = yield* Effect.succeed({ id, name: "Satoshi", balance: 1.5 });

    return user;
  });

// ============================================
// 2. 制御フローを使う
// ============================================

const processOrder = (symbol: string, amount: number) =>
  Effect.gen(function*() {
    // if文も普通に使える
    if (amount <= 0) {
      // yield* Effect.fail で早期リターン（throwみたいなもの）
      return yield* Effect.fail(new ValidationError({ field: "amount" }));
    }

    yield* Console.log(`注文処理: ${symbol} x ${amount}`);

    // 他のEffectを呼べる
    const user = yield* fetchUser(1);

    if (user.balance < amount) {
      return yield* Effect.fail(new ApiError({ message: "残高不足" }));
    }

    return { orderId: "ORD-001", symbol, amount, user: user.name };
  });

// ============================================
// 3. 実行してみる
// ============================================

console.log("--- 正常系 ---");
const result1 = Effect.runSync(
  processOrder("BTCUSDT", 0.5).pipe(
    Effect.catchAll((e) => {
      console.log(`エラー: ${e._tag}`);
      return Effect.succeed(null);
    }),
  ),
);
console.log("結果:", result1);

console.log("\n--- バリデーションエラー ---");
const result2 = Effect.runSync(
  processOrder("BTCUSDT", -1).pipe(
    Effect.catchTag("ValidationError", (e) => {
      console.log(`バリデーション失敗: ${e.field}`);
      return Effect.succeed(null);
    }),
    Effect.catchTag("ApiError", (e) => {
      console.log(`APIエラー: ${e.message}`);
      return Effect.succeed(null);
    }),
  ),
);
console.log("結果:", result2);

// ============================================
// 4. for ループで複数のEffectを実行
// ============================================

console.log("\n--- 複数シンボルを処理 ---");

const processMultiple = Effect.gen(function*() {
  const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
  const results: string[] = [];

  for (const symbol of symbols) {
    yield* Console.log(`処理中: ${symbol}`);
    results.push(`${symbol}: OK`);
  }

  return results;
});

const result3 = Effect.runSync(processMultiple);
console.log("結果:", result3);

// ============================================
// 5. Effect.all - 並列実行
// ============================================

console.log("\n--- 並列実行 ---");

const parallel = Effect.all([fetchUser(1), fetchUser(2), fetchUser(3)], {
  concurrency: "unbounded",
}); // 並列で実行

const result4 = Effect.runSync(parallel);
console.log("並列結果:", result4);

// ============================================
// 練習問題
// ============================================
// 1. subscribeTicker(symbol) を Effect.gen で書いてみよう
//    - symbol が空文字ならバリデーションエラー
//    - 成功時は { symbol, price: 50000 } を返す

const subscribeTicker = (symbol: string) =>
  Effect.gen(function*() {
    if (symbol === "") {
      return yield* Effect.fail(new ValidationError({ field: "symbol" }));
    }

    return {
      symbol,
      price: 50000,
    };
  });

// 2. 複数のティッカーを Effect.all で同時に取得してみよう
const tickers = Effect.all(
  [
    subscribeTicker("BTCUSDT"),
    subscribeTicker("SOLUSDT"),
    subscribeTicker("PUMPUSDT"),
  ],
  { concurrency: "unbounded" },
);

const result = Effect.runSync(tickers);
console.log(result);
