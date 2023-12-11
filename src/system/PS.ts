import * as T from "effect/Effect";
import { pipe } from "effect/Function";
import { exec, spawn, ExecException } from "child_process";
import { ConsoleEnv } from "../core/ConsoleEnv";

import kill from "tree-kill";

export const PS = {
  spawn: (context: string) => (command: string) => (args: string[]) =>
    pipe(
      T.environment<ConsoleEnv>(),
      T.tap((t) =>
        T.sync(() => {
          t.console.log(context)(command + " " + args.join(" "));
        })
      ),
      T.flatMap(({ console }) =>
        T.effectAsyncInterrupt<unknown, number, 0>((cb) => {
          const child = spawn(command, args);

          child.stdout.on("data", (data) => {
            console.log(context)(data.toString());
          });

          child.stderr.on("data", (data) => {
            console.error(context)(data.toString());
          });

          child.on("close", (code) => {
            if (code === 0) {
              cb(T.succeed(code));
            } else {
              cb(T.fail(code));
            }
          });
          return T.sync(() => {
            kill(child.pid);
          });
        })
      )
    ),
  exec: (command: string) =>
    T.effectAsync<unknown, ExecException | string, string>((cb) => {
      exec(command, (err, stdout, stderr) => {
        if (err) {
          cb(T.fail(err));
        } else if (stderr) {
          cb(T.fail(stderr));
        } else {
          cb(T.succeed(stdout));
        }
      });
    }),
};
