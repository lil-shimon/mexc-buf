import { fromBinary } from "@bufbuild/protobuf";
import {
  Data,
  Effect,
  Context,
  Layer,
  Stream,
  Console,
  Schedule,
} from "effect";
import Websocket from "ws";
import { PushDataV3ApiWrapperSchema } from "./gen/PushDataV3ApiWrapper_pb";

class NetworkError extends Data.TaggedError("NetworkError")<{
  message: string;
}> { }

class DecodeError extends Data.TaggedError("DecodeError")<{
  message: string;
}> { }

class Config extends Context.Tag("Config")<
  Config,
  {
    readonly endpoint: string;
  }
>() { }

class ReqClient extends Context.Tag("ReqClient")<
  ReqClient,
  {
    readonly method: string;
    readonly params: string[];
  }
>() { }

class MexcClient extends Context.Tag("MexcClient")<
  MexcClient,
  {
    readonly connect: (
      endpoint: string,
    ) => Effect.Effect<Websocket, NetworkError>;
  }
>() { }

const ConfigLive = Layer.succeed(Config, {
  endpoint: "wss://wbs-api.mexc.com/ws",
});

const ReqClientLive = Layer.succeed(ReqClient, {
  method: "SUBSCRIPTION",
  params: ["spot@public.aggre.deals.v3.api.pb@100ms@BTCUSDT"],
});

const MexcClientLive = Layer.succeed(MexcClient, {
  connect: (endpoint) =>
    Effect.tryPromise({
      try: () =>
        new Promise<Websocket>((resolve, reject) => {
          const ws = new Websocket(endpoint);
          ws.on("open", () => {
            console.log("open");
            resolve(ws);
          });
          ws.on("error", (err) => reject(err));
        }),
      catch: () => new NetworkError({ message: "NetworkError" }),
    }),
});

const messageStream = (ws: Websocket) =>
  Stream.async<Buffer, NetworkError>((emit) => {
    ws.on("message", (data) => {
      emit.single(data as Buffer);
    });

    ws.on("error", (err) => {
      emit.fail(new NetworkError({ message: String(err) }));
    });

    ws.on("close", () => {
      emit.end();
    });
  });

const decode = (data: Buffer) =>
  Effect.try({
    try: () => fromBinary(PushDataV3ApiWrapperSchema, new Uint8Array(data)),
    catch: (err) =>
      new DecodeError({ message: `protobuf decode error: ${String(err)}` }),
  });

const pingLoop = (ws: Websocket) =>
  Effect.repeat(
    Effect.sync(() => ws.send(JSON.stringify({ method: "ping" }))),
    Schedule.spaced("30 seconds"),
  );

const run = Effect.gen(function*() {
  const config = yield* Config;
  const req = yield* ReqClient;
  const client = yield* MexcClient;

  const ws = yield* client.connect(config.endpoint);
  ws.send(JSON.stringify(req));

  yield* Effect.fork(pingLoop(ws));

  yield* messageStream(ws).pipe(
    Stream.filter((data) => typeof data !== "string"),
    Stream.mapEffect((data) =>
      decode(data).pipe(
        // NOTE: 最初にくるメッセージのハンドリングが必要かも。
        // エラーが発生する。
        // 今は握りつぶしてる。return Effect.succeed(null)
        Effect.catchTag("DecodeError", (err) => {
          console.log(String(err));
          return Effect.succeed(null);
        }),
      ),
    ),
    Stream.runForEach((data) => Console.log(data)),
  );
});

const mainLive = Layer.mergeAll(ConfigLive, MexcClientLive, ReqClientLive);
Effect.runPromise(run.pipe(Effect.provide(mainLive)));
