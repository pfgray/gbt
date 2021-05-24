import * as T from "@effect-ts/core/Effect";
import { flow, pipe } from "@effect-ts/core/Function";
import chokidar from "chokidar";

export interface WatchEnv {
  watchEnv: {
    dir: (
      dirname: string,
      onChange: (path: string) => T.UIO<unknown>
    ) => { cleanup: () => void };
  };
}

export const WatchE = {
  dir: (
    dirname: string,
    onChange: (path: string) => T.UIO<unknown>
  ): T.Effect<WatchEnv, number, 0> =>
    pipe(
      T.environment<WatchEnv>(),
      T.chain(({ watchEnv }) =>
        T.effectAsyncInterrupt<unknown, number, 0>((cb) => {
          const { cleanup } = watchEnv.dir(dirname, onChange);
          return T.effectTotal(() => {
            cleanup();
          });
        })
      )
    ),
};

export const ChokidarWatchEnv: WatchEnv = {
  watchEnv: {
    dir: (dirname, onChange) => {
      const watcher = chokidar.watch(dirname);
      watcher.on("change", flow(onChange, T.run));
      return {
        cleanup: () => {
          // hmm, chokidar docs say .close() returns a promise,
          // but the types say otherwise...
          watcher.close();
        },
      };
    },
  },
};
