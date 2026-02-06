import { Console, Effect } from "effect";
import { PushDataV3ApiWrapperSchema } from "./gen/PushDataV3ApiWrapper_pb";
import Websocket from "ws";
import { fromBinary } from "@bufbuild/protobuf";

const program = Console.log("Hello world");
const endpoint = "wss://wbs-api.mexc.com/ws";

const req = {
  method: "SUBSCRIPTION",
  params: ["spot@public.aggre.deals.v3.api.pb@100ms@BTCUSDT"],
};

Effect.runSync(program);

const ws = new Websocket(endpoint);

const run = () => {
  ws.on("open", () => {
    ws.send(JSON.stringify(req));
  });

  ws.on("message", (data) => {
    if (typeof data === 'string') {
      console.log('data is string')
      return;
    }

    const bytes = data instanceof Buffer ? new Uint8Array(data) : data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data as any)

    try {
      const decode = fromBinary(PushDataV3ApiWrapperSchema, bytes)
      console.log(decode.body)
      console.log(decode.body.value)
    } catch (err) {
      console.error(err)
    }
  });
};

run();
