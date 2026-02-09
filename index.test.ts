import { describe, it, expect } from "bun:test";
import { Effect, TestClock, TestContext, Fiber } from "effect";
import { create, toBinary } from "@bufbuild/protobuf";
import { PushDataV3ApiWrapperSchema } from "./gen/PushDataV3ApiWrapper_pb";
import { decode, pingLoop } from "./index";

describe("decode", () => {
  it("valid protobuf → decoded message", async () => {
    const msg = create(PushDataV3ApiWrapperSchema, {
      channel: "test-channel",
      symbol: "BTCUSDT",
    });
    const binary = Buffer.from(toBinary(PushDataV3ApiWrapperSchema, msg));
    const result = await Effect.runPromise(decode(binary));
    expect(result.channel).toBe("test-channel");
    expect(result.symbol).toBe("BTCUSDT");
  });

  it("invalid binary → DecodeError", async () => {
    const garbage = Buffer.from([0xff, 0xfe, 0xfd]);
    const exit = await Effect.runPromise(
      decode(garbage).pipe(
        Effect.match({
          onSuccess: () => ({ _tag: "success" as const }),
          onFailure: (e) => ({ _tag: e._tag, message: e.message }),
        }),
      ),
    );
    expect(exit._tag).toBe("DecodeError");
  });
});

describe("pingLoop", () => {
  it("sends ping JSON on ws.send", async () => {
    const sent: string[] = [];
    const mockWs = { send: (d: string) => sent.push(d) } as any;

    await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* Effect.fork(pingLoop(mockWs));
        yield* TestClock.adjust("30 seconds");
        yield* Fiber.interrupt(fiber);
      }).pipe(Effect.provide(TestContext.TestContext)),
    );

    expect(sent.length).toBeGreaterThanOrEqual(2);
    expect(sent[0]).toBe(JSON.stringify({ method: "ping" }));
  });

  it("respects 30-second interval via TestClock", async () => {
    const sent: string[] = [];
    const mockWs = { send: (d: string) => sent.push(d) } as any;

    await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* Effect.fork(pingLoop(mockWs));
        // t=0: 1回目のsend実行済み
        yield* TestClock.adjust("29 seconds");
        const countAt29 = sent.length;
        yield* TestClock.adjust("1 seconds");
        const countAt30 = sent.length;
        yield* TestClock.adjust("30 seconds");
        const countAt60 = sent.length;
        yield* Fiber.interrupt(fiber);

        expect(countAt29).toBe(1);
        expect(countAt30).toBe(2);
        expect(countAt60).toBe(3);
      }).pipe(Effect.provide(TestContext.TestContext)),
    );
  });
});
