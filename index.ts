import { Data, Effect, Context, Layer } from "effect";
import Websocket from "ws";

class NetworkError extends Data.TaggedError("NetworkError")<{
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
    readonly send: (
      ws: Websocket,
      req: Context.Tag.Service<typeof ReqClient>,
    ) => Effect.Effect<void, NetworkError>;
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
  send: (ws, req) => Effect.sync(() => ws.send(JSON.stringify(req))),
});

const receive = (ws: Websocket): Effect.Effect<Buffer, NetworkError> =>
  Effect.tryPromise({
    try: () =>
      new Promise<Buffer>((resolve, reject) => {
        ws.once("message", (data) => {
          resolve(data as Buffer);
        });
        ws.once("error", (err) => reject(err));
      }),
    catch: () => new NetworkError({ message: "receive failed" }),
  });

const run = Effect.gen(function*() {
  const config = yield* Config;
  const req = yield* ReqClient;
  const client = yield* MexcClient;

  const ws = yield* client.connect(config.endpoint);
  yield* client.send(ws, req);

  const data = receive(ws);
  console.log(data);
});

const mainLive = Layer.mergeAll(ConfigLive, MexcClientLive, ReqClientLive);
Effect.runPromise(run.pipe(Effect.provide(mainLive)));
