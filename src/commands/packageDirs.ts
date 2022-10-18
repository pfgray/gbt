import { pipe } from "@effect-ts/core/Function";
import * as A from "@effect-ts/core/Array";
import * as O from "@effect-ts/core/Option";
import * as T from "@effect-ts/core/Effect";
import { Command } from "./Command";

export const PackageDirsCommand: Command<"package-dirs", {}> = {
  name: "package-dirs",
  addCommand: (yargs) =>
    yargs.command("package-dirs", "list every package directory"),
  parseArgs: (argv, rawArgs) =>
    pipe(
      A.head(rawArgs),
      T.fromOption,
      T.chain((command) =>
        command === "package-dirs"
          ? T.succeed(O.some({ _type: "package-dirs" as const }))
          : T.succeed(O.none)
      )
    ),
  executeCommand: (context) => (args) =>
    T.effectTotal(() => {
      context.workspaces.forEach((w) => {
        console.log(w.dir);
      });
    }),
};
