import { pipe } from "effect/Function";
import * as A from "effect/ReadonlyArray";
import * as O from "effect/Option";
import * as T from "effect/Effect";
import { Command } from "./Command";
import { gradientForStr } from "../core/console/gradients";

export const ListCommand: Command<"list", {}> = {
  name: "list",
  addCommand: (yargs) =>
    yargs.command("list", "list every workspace in the project"),
  parseArgs: (argv, rawArgs) =>
    pipe(
      A.head(rawArgs),
      T.flatMap((command) =>
        command === "list"
          ? T.succeed(O.some({ _type: "list" as const }))
          : T.succeed(O.none())
      )
    ),
  executeCommand: (context) => (args) =>
    T.sync(() => {
      context.workspaces.forEach((w) => {
        console.log(`${gradientForStr(w.package.name)}:${w.package.version}`);
      });
    }),
};
