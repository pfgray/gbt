import * as T from "effect/Effect";
import { pipe } from "effect/Function";
import { exec, spawn, ExecException } from "child_process";

import kill from "tree-kill";
import { Reporter } from "../core/console/Reporter";
import { ReporterService } from "../core/console/Reporter";

export const PS = {
  spawn: (context: string) => (command: string) => (args: string[]) =>
    pipe(
      Reporter.log(context)(command + " " + args.join(" ")),
      T.bindTo("intro"),
      T.bind("console", () => ReporterService),
      T.flatMap(({ console }) =>
        T.async<never, number, 0>((cb) => {
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
    T.async<never, ExecException | string, string>((cb) => {
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
