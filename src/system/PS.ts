import * as T from "effect/Effect";
import { pipe } from "effect/Function";
import { exec, spawn, ExecException } from "child_process";

import kill from "tree-kill";
import { Reporter } from "../core/console/Reporter";
import { ReporterService } from "../core/console/Reporter";

export type ProcessError = {
  _tag: "process-error";
  code: number;
};

export const processError = (code: number): ProcessError => ({
  _tag: "process-error",
  code,
});

export const PS = {
  spawn: (context: string) => (command: string) => (args: string[]) =>
    pipe(
      Reporter.log(context)(command + " " + args.join(" ")),
      T.bindTo("intro"),
      T.bind("console", () => ReporterService),
      T.flatMap(({ console }) =>
        T.async<0, number, never>((cb) => {
          const child = spawn(command, args);

          child.stdout.on("data", (data) => {
            pipe(console.log(context)(data.toString()), T.runSync);
          });

          child.stderr.on("data", (data) => {
            pipe(console.error(context)(data.toString()), T.runSync);
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
      ),
      T.mapError((errCode) => processError(errCode))
    ),
  exec: (command: string) =>
    T.async<string, ExecException | string, never>((cb) => {
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
