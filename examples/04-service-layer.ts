/**
 * Service & Layer - Step 4
 *
 * 学ぶこと:
 * - Context.Tag でServiceを定義（インターフェース）
 * - Layer でServiceの実装を提供
 * - Effect.provide でLayerを注入
 * - なぜDIが必要か → テスト・環境切り替え
 *
 * 実行: bun run examples/04-service-layer.ts
 */
import { connect } from "bun";
import { Effect, Context, Layer, Console, Data } from "effect";

// ============================================
// 1. Serviceを定義する（インターフェース）
// ============================================

// "このプログラムには Config が必要です" という宣言
class Config extends Context.Tag("Config")<
  Config,
  {
    readonly wsUrl: string;
    readonly symbol: string;
    readonly intervalMs: number;
  }
>() { }

// "このプログラムには Logger が必要です" という宣言
class Logger extends Context.Tag("Logger")<
  Logger,
  {
    readonly info: (msg: string) => Effect.Effect<void>;
    readonly error: (msg: string) => Effect.Effect<void>;
  }
>() { }

// ============================================
// 2. Serviceを使うプログラムを書く
// ============================================

// ※ この時点では実装は一切知らない。インターフェースだけに依存。
const program = Effect.gen(function*() {
  // Serviceを取得（yield* で依存を解決）
  const config = yield* Config;
  const logger = yield* Logger;

  yield* logger.info(`接続先: ${config.wsUrl}`);
  yield* logger.info(`シンボル: ${config.symbol}`);
  yield* logger.info(`間隔: ${config.intervalMs}ms`);

  return `${config.symbol} の監視を開始`;
});
// 型: Effect<string, never, Config | Logger>
//                              ^^^^^^^^^^^^ Requirementsに依存が出る！

// ============================================
// 3. Layerで実装を提供する
// ============================================

// 本番用の Config Layer
const ConfigLive = Layer.succeed(Config, {
  wsUrl: "wss://wbs-api.mexc.com/ws",
  symbol: "BTCUSDT",
  intervalMs: 100,
});

// 本番用の Logger Layer
const LoggerLive = Layer.succeed(Logger, {
  info: (msg: string) => Console.log(`[INFO] ${msg}`),
  error: (msg: string) => Console.error(`[ERROR] ${msg}`),
});

// テスト用の Logger Layer（何も出力しない）
const LoggerTest = Layer.succeed(Logger, {
  info: (_msg: string) => Effect.void,
  error: (_msg: string) => Effect.void,
});

// ============================================
// 4. Layerを合成して注入する
// ============================================

console.log("--- 本番環境 ---");

// Layer.merge で複数のLayerを合成
const MainLive = Layer.merge(ConfigLive, LoggerLive);

const result1 = Effect.runSync(program.pipe(Effect.provide(MainLive)));
console.log("結果:", result1);

console.log("\n--- テスト環境 ---");

// Loggerだけ差し替え！
const MainTest = Layer.merge(ConfigLive, LoggerTest);

const result2 = Effect.runSync(program.pipe(Effect.provide(MainTest)));
console.log("結果:", result2); // ログは出ないがプログラムは同じ

// ============================================
// 5. Layerが他のLayerに依存するパターン
// ============================================

console.log("\n--- Layer依存 ---");

class HttpClient extends Context.Tag("HttpClient")<
  HttpClient,
  { readonly get: (url: string) => Effect.Effect<string> }
>() { }

// HttpClient の実装は Config に依存する
const HttpClientLive = Layer.effect(
  HttpClient,
  Effect.gen(function*() {
    const config = yield* Config; // ← ConfigをLayerから受け取る

    return {
      get: (path: string) => Effect.succeed(`GET ${config.wsUrl}${path} -> OK`),
    };
  }),
);

// HttpClientLive は Config を必要とする
// Config を HttpClientLive に渡す
const HttpClientWithConfig = HttpClientLive.pipe(
  Layer.provide(ConfigLive), // Config を注入
);

const program2 = Effect.gen(function*() {
  const http = yield* HttpClient;
  const result = yield* http.get("/api/ticker");
  return result;
});

const result3 = Effect.runSync(
  program2.pipe(Effect.provide(HttpClientWithConfig)),
);
console.log("HTTP結果:", result3);

// ============================================
// 練習問題
// ============================================
// 1. MexcClient Service を定義してみよう
//    - connect(): Effect<WebSocket, NetworkError>
//    - subscribe(channel: string): Effect<void, NetworkError>
class NetworkError extends Data.TaggedError("NetworkError")<{
  url: string;
  status: number;
}> { }

class MexcClient extends Context.Tag("MexcClient")<
  MexcClient,
  {
    readonly connect: () => Effect.Effect<WebSocket, NetworkError>;
    readonly subscribe: (channel: string) => Effect.Effect<void, NetworkError>;
  }
>() { }

// 2. MexcClientLive と MexcClientMock の2つの Layer を作ってみよう

const MexcClientLive = Layer.succeed(MexcClient, {
  connect: () => Effect.succeed(new WebSocket("wss://live.com/ws")),
  subscribe: (channel) => Console.log(`subscribed: ${channel}`),
});

const MexcClientTest = Layer.succeed(MexcClient, {
  connect: () => Effect.succeed(new WebSocket("wss://test.com/ws")),
  subscribe: (channel) => Console.log(`test subscribed: ${channel}`),
});

const mexcProgram = Effect.gen(function*() {
  const client = yield* MexcClient;
  yield* client.subscribe("mexc WebSocket");
});

Effect.runSync(mexcProgram.pipe(Effect.provide(MexcClientLive)));
Effect.runSync(mexcProgram.pipe(Effect.provide(MexcClientTest)));
