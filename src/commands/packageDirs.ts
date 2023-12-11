import { pipe } from "effect/Function";
import * as A from "effect/ReadonlyArray";
import * as O from "effect/Option";
import * as T from "effect/Effect";
import { Command } from "./Command";

export const PackageDirsCommand: Command<"package-dirs", {}> = {
  name: "package-dirs",
  addCommand: (yargs) =>
    yargs.command("package-dirs", "list every package directory"),
  parseArgs: (argv, rawArgs) =>
    pipe(
      A.head(rawArgs),
      T.fromOption,
      T.flatMap((command) =>
        command === "package-dirs"
          ? T.succeed(O.some({ _type: "package-dirs" as const }))
          : T.succeed(O.none)
      )
    ),
  executeCommand: (context) => (args) =>
    T.sync(() => {
      context.workspaces.forEach((w) => {
        console.log(w.dir);
      });
    }),
};
