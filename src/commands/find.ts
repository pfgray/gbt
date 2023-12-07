import { pipe } from "effect/Function";
import * as A from "effect/ReadonlyArray";
import * as O from "effect/Option";
import * as T from "effect/Effect";
import { Command } from "./Command";

export const FindCommand: Command<"find", { pkg: string }> = {
  name: "find",
  addCommand: (yargs) => yargs.command("find", "find a package's directory"),
  parseArgs: (argv, rawArgs) =>
    pipe(
      A.head(rawArgs),
      O.filter((command) => command === "find"),
      O.fold(
        () => T.succeed(O.none),
        () =>
          pipe(
            rawArgs,
            A.dropLeft(1),
            A.head,
            O.filter((p): p is string => typeof p === "string"),
            O.fold(
              () => T.fail(`find requires a <package> argument`),
              (pkg) => T.succeed(O.some({ _type: "find" as const, pkg }))
            )
          )
      )
    ),
  executeCommand: (context) => (args) =>
    T.effectTotal(() => {
      pipe(
        context.workspaces,
        A.findFirst((p) => p.package.name === args.pkg),
        O.fold(
          () => {
            console.error(`Package ${args.pkg} not found`);
          },
          (p) => {
            console.log(p.dir);
          }
        )
      );
    }),
};
