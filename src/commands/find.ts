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
      O.match({
        onNone: () => T.succeed(O.none()),
        onSome: () =>
          pipe(
            rawArgs,
            A.drop(1),
            A.head,
            O.filter((p): p is string => typeof p === "string"),
            O.match({
              onNone: () => T.fail(`find requires a <package> argument`),
              onSome: (pkg) =>
                T.succeed(O.some({ _type: "find" as const, pkg })),
            })
          ),
      })
    ),
  executeCommand: (context) => (args) =>
    T.sync(() => {
      pipe(
        context.workspaces,
        A.findFirst((p) => p.package.name === args.pkg),
        O.match({
          onNone: () => {
            console.error(`Package ${args.pkg} not found`);
          },
          onSome: (p) => {
            console.log(p.dir);
          },
        })
      );
    }),
};
