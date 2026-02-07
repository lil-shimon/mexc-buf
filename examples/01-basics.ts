/**
 * Effect 基礎 - Step 1
 *
 * 学ぶこと:
 * - Effectとは「まだ実行されていないプログラムの設計図」
 * - Effect.succeed / Effect.fail で作る
 * - pipe で処理を繋ぐ
 * - Effect.runSync / Effect.runPromise で実行する
 *
 * 実行: bun run examples/01-basics.ts
 */
import { Effect, pipe, Console } from "effect";

// ============================================
// 1. Effectを作る
// ============================================

// 成功するEffect (Promise.resolve(42) みたいなもの)
const success = Effect.succeed(42);

// 失敗するEffect (Promise.reject("boom") みたいなもの)
const failure = Effect.fail("boom");

// ※ この時点ではまだ何も実行されていない！ただの「設計図」

// ============================================
// 2. Effectを変換する (map)
// ============================================

// Promiseの .then() に相当
const doubled = Effect.map(success, (n) => n * 2);

// pipeで書くと読みやすい（下に流れる）
const tripled = pipe(
  success,
  Effect.map((n) => n * 3),
  Effect.map((n) => `結果: ${n}`),
);

// ============================================
// 3. Effectを実行する
// ============================================

// 同期実行
console.log("--- runSync ---");
const result1 = Effect.runSync(doubled);
console.log(result1); // 84

const result2 = Effect.runSync(tripled);
console.log(result2); // "結果: 126"

// Promise化して実行
console.log("\n--- runPromise ---");
Effect.runPromise(doubled).then((r) => console.log("Promise結果:", r));

// ============================================
// 4. Effect vs Promise 比較
// ============================================

// Promise: 作った瞬間に実行される
const p = new Promise((resolve) => {
  console.log("即実行！"); // ← すぐ表示される
  resolve(1);
});

// Effect: runするまで何も起きない
const lazy = Effect.sync(() => {
  console.log("\n--- lazy evaluation ---");
  console.log("runした時だけ実行される！");
  return 100;
});

// ここではまだ何も表示されない
console.log("lazyを作ったが、まだ実行してない");

// ここで初めて実行される
const result3 = Effect.runSync(lazy);
console.log("結果:", result3);

// ============================================
// 練習問題
// ============================================
// 1. Effect.succeed("BTCUSDT") を作って、文字列を小文字に変換して実行してみよう

// const pair = Effect.succeed("BTCUSDT");
// const lower = pipe(
//   pair,
//   Effect.map((string) => string.toLowerCase()),
//   Effect.map((str) => console.log(str)),
// );
// Effect.runSync(lower);

const pair = Effect.succeed("BTCUSDT");
const lower = pipe(
  pair,
  Effect.map((string) => string.toLowerCase()),
  Effect.tap((str) => Console.log(str)),
);
Effect.runSync(lower);


// 2. pipe を使って、数値を 2倍 → 文字列化 → "Price: xxx" の形に変換してみよう

const number = Effect.succeed(300);
const price = pipe(
  number,
  Effect.map((n) => n * 2),
  Effect.map((n) => n.toString()),
  Effect.map((str) => `Price: ${str}`),
  Effect.tap((str) => Console.log(str)),
);

Effect.runSync(price);
