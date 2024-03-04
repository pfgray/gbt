import { Context, Effect, Layer, pipe } from "effect";
import * as T from "effect/Effect";

export interface Watch {
  dir: (
    dirname: string,
    onChange: (path: string) => T.Effect<unknown, never, never>
  ) => { cleanup: () => void };
}

export class WatchService extends Context.Tag("WatchService")<
  WatchService,
  Watch
>() {}

export const Watch = {
  dir: (
    dirname: string,
    onChange: (path: string) => T.Effect<unknown, never, never>
  ): T.Effect<0, number, WatchService> =>
    pipe(
      WatchService,
      T.flatMap(({ dir }) =>
        T.async<0, number, never>((cb) => {
          const { cleanup } = dir(dirname, onChange);
          return T.sync(() => {
            console.log("cleaning", dirname);
            cleanup();
          });
        })
      )
    ),
};
