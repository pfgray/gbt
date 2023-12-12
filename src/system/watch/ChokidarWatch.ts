import { Watch, WatchService } from "./Watch";
import chokidar from "chokidar";
import { Layer } from "effect";
import * as T from "effect/Effect";
import { flow } from "effect/Function";

export const ChokidarWatch = Layer.succeed(
  WatchService,
  WatchService.of({
    dir: (dirname, onChange) => {
      const watcher = chokidar.watch(dirname);
      watcher.on("change", flow(onChange, T.runSync));
      return {
        cleanup: () => {
          // hmm, chokidar docs say .close() returns a promise,
          // but the types say otherwise...
          watcher.close();
        },
      };
    },
  })
);
