import { literal, pipe } from "@effect-ts/core/Function";
import * as A from "@effect-ts/core/Array";
import * as O from "@effect-ts/core/Option";
import * as T from "@effect-ts/core/Effect";
import { Command } from "./Command";
import { gradientForStr } from "../cli/StdoutConsoleEnv";


export const ListCommand: Command<"list", {}> = {
  addCommand: (yargs) =>
    yargs.command(
      "list",
      "list every workspace in the project"
    ),
  parseArgs: (argv, rawArgs) =>
    pipe(
      A.head(rawArgs),
      T.fromOption,
      T.chain((command) =>
        command === "list" ? T.succeed(O.some({ _type: "list" as const })) : T.succeed(O.none)
      )
    ),
  executeCommand: (context) => (args) =>
    T.effectTotal(() => {
      context.workspaces.forEach(w => {
        console.log(`${gradientForStr(w.package.name)(w.package.name)}:${w.package.version}`)
      })
    })
};

