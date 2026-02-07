/**
 * Effect 練習問題 - TODOアプリ
 *
 * DB不要。全てインメモリ。Effectの練習に集中する。
 * 各問題を順番に実装してください。
 *
 * 実行: bun run examples/06-todo-exercises.ts
 */
import { Effect, Data, Context, Layer, Console, pipe } from "effect";

// ============================================
// 型定義（これは使ってOK）
// ============================================

interface Todo {
  id: number;
  title: string;
  done: boolean;
}

// ============================================
// エラー定義（これも使ってOK）
// ============================================

class NotFoundError extends Data.TaggedError("NotFoundError")<{
  id: number;
}> { }

class ValidationError extends Data.TaggedError("ValidationError")<{
  reason: string;
}> { }

// ============================================
// 問1: add - TODOを追加する
//
// - title が空文字なら ValidationError
// - 成功したら Todo を返す
// - id は todos.length + 1 でOK
// ============================================

const todos: Todo[] = [];

// ここに add を実装してください
// const add = (title: string): Effect.Effect<Todo, ValidationError> => ...

const add = (title: string): Effect.Effect<Todo, ValidationError> =>
  Effect.gen(function*() {
    if (title === "") {
      return yield* Effect.fail(
        new ValidationError({ reason: "title is required" }),
      );
    }

    const id = todos.length + 1;
    const done = false;

    const newTodo: Todo = { id, title, done };
    todos.push(newTodo);
    return newTodo;
  });

// ============================================
// 問2: findById - IDでTODOを検索する
//
// - 見つからなければ NotFoundError
// - 見つかったら Todo を返す
// ============================================

// ここに findById を実装してください

const findById = (id: number): Effect.Effect<Todo, NotFoundError> =>
  Effect.gen(function*() {
    const todo = todos.find((t) => t.id === id);

    if (!todo) {
      return yield* Effect.fail(new NotFoundError({ id }));
    }

    return todo;
  });
// ============================================
// 問3: toggle - TODOの完了状態を切り替える
//
// - findById を使って検索（NotFoundError が伝播する）
// - done を反転させて返す
// ============================================

// ここに toggle を実装してください
// const toggle = (id: number): Effect.Effect<Todo, NotFoundError> => ...

const toggle = (id: number): Effect.Effect<Todo, NotFoundError> =>
  Effect.gen(function*() {
    const todo = yield* findById(id);
    todo.done = !todo.done;
    return todo;
  });

// ============================================
// 問4: 全部繋げて実行する
//
// Effect.gen で以下を順番に実行：
// 1. "買い物" を追加
// 2. "掃除" を追加
// 3. "料理" を追加
// 4. id=2 を完了にする
// 5. id=99 を検索する（NotFoundError になるはず）
// 6. 全エラーをハンドリングして実行
// ============================================

// ここに program を実装してください

const program = Effect.gen(function*() {
  yield* add("買い物");
  yield* add("掃除");
  yield* add("料理");

  const toggled = yield* toggle(2);
  yield* Console.log("toggled", toggled.title, toggled.id, toggled.done);

  const notFound = yield* findById(99);

  yield* Console.log(notFound);
});

const piped = program.pipe(
  Effect.catchTag("ValidationError", (e) => {
    Console.log("ValidationError: ", e.reason);
    return Effect.succeed(false);
  }),

  Effect.catchTag("NotFoundError", (e) => {
    Console.log("NotFoundError. ID: ", e.id);
    return Effect.succeed(false);
  }),
);

Effect.runSync(piped);
// ============================================
// 問5（ボーナス）: TodoRepository Service を作る
//
// 問1-3の関数を Service/Layer に切り出す：
// - TodoRepository Service を定義
// - TodoRepositoryLive Layer を実装
// - program を書き換えて Service 経由で操作する
// ============================================

// ここに Service/Layer を実装してください
