import { pipe } from "@effect-ts/core/Function";
import * as A from "@effect-ts/core/Array";
import * as O from "@effect-ts/core/Option";
import * as T from "@effect-ts/core/Effect";
import { Command } from "./Command";

export const VersionCommand: Command<"version", { pkg: string }> = {
  name: "version",
  addCommand: (yargs) => yargs.command("version", "Get version of package"),
  parseArgs: (argv, rawArgs) =>
    pipe(
      A.head(rawArgs),
      O.map((command) => ({ command })),
      (a) => a,
      O.bind("pkg", () => pipe(rawArgs, A.dropLeft(1), A.head)),
      (a) => a,
      T.fromOption,
      T.chain(({ command, pkg }) =>
        command === "version" && typeof pkg === "string"
          ? T.succeed(O.some({ _type: "version" as const, pkg }))
          : T.succeed(O.none)
      )
    ),
  executeCommand: (context) => (args) =>
    T.effectTotal(() => {
      pipe(
        context.workspaces,
        A.findFirst((p) => p.package.name === args.pkg),
        O.map((w) => {
          console.log(w.package.version);
        })
      );
    }),
};
