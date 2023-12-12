import { pipe } from "effect/Function";
import * as A from "effect/ReadonlyArray";
import * as O from "effect/Option";
import * as T from "effect/Effect";
import { Command } from "./Command";

export const VersionCommand: Command<"version", { pkg: string }> = {
  name: "version",
  addCommand: (yargs) => yargs.command("version", "Get version of package"),
  parseArgs: (argv, rawArgs) =>
    pipe(
      A.head(rawArgs),
      O.map((command) => ({ command })),
      O.bind("pkg", () => pipe(rawArgs, A.drop(1), A.head)),
      T.flatMap(({ command, pkg }) =>
        command === "version" && typeof pkg === "string"
          ? T.succeed(O.some({ _type: "version" as const, pkg }))
          : T.succeed(O.none())
      )
    ),
  executeCommand: (context) => (args) =>
    T.sync(() => {
      pipe(
        context.workspaces,
        A.findFirst((p) => p.package.name === args.pkg),
        O.map((w) => {
          console.log(w.package.version);
        })
      );
    }),
};
