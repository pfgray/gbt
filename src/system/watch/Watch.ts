import { Context, Effect, Layer, pipe } from "effect";
import * as T from "effect/Effect";

export interface Watch {
  dir: (
    dirname: string,
    onChange: (path: string) => T.Effect<never, never, unknown>
  ) => { cleanup: () => void };
}

export const WatchService = Context.Tag<Watch>();

export const Watch = {
  dir: (
    dirname: string,
    onChange: (path: string) => T.Effect<never, never, unknown>
  ): T.Effect<Watch, number, 0> =>
    pipe(
      WatchService,
      T.flatMap(({ dir }) =>
        T.async<never, number, 0>((cb) => {
          const { cleanup } = dir(dirname, onChange);
          return T.sync(() => {
            console.log("cleaning", dirname);
            cleanup();
          });
        })
      )
    ),
};
