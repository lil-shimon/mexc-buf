import { Data, Effect, Context, Layer, Console } from "effect";
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

const run = Effect.gen(function*() {
  const config = yield* Config;
  const req = yield* ReqClient;
  const client = yield* MexcClient;

  yield* client.connect(config.endpoint);
});

const mainLive = Layer.mergeAll(ConfigLive, MexcClientLive, ReqClientLive);
Effect.runPromise(run.pipe(Effect.provide(mainLive)));
