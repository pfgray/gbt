#!/usr/bin/env node
import * as T from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as A from "effect/ReadonlyArray";
import { makeMatchers } from "ts-adt/MakeADT";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { Command } from "../commands/Command";
import { BuildCommand } from "../commands/build";
import { DetectCyclesCommand } from "../commands/detectCycles";
import { FindCommand } from "../commands/find";
import { ListCommand } from "../commands/list";
import { PackageDirsCommand } from "../commands/packageDirs";
import { StartCommand } from "../commands/start";
import { StatsCommand } from "../commands/stats";
import { TreeCommand } from "../commands/tree";
import { AppWithDeps } from "../core/AppWithDeps";
import { PackageJson } from "../core/PackageJson";
import { initialize } from "../core/intialize";

const [matchTag, matchTagP] = makeMatchers("_tag");

const Commands = [
  StartCommand,
  BuildCommand,
  ListCommand,
  PackageDirsCommand,
  StatsCommand,
  FindCommand,
  TreeCommand,
  DetectCyclesCommand,
  //VersionCommand,
];

const handleCommand =
  (
    context: {
      rootProject: PackageJson;
    } & {
      workspaces: ReadonlyArray<AppWithDeps>;
    },
    argv: Record<string, unknown>,
    rawArgs: (string | number)[]
  ) =>
  <K extends string, T extends object>(c: Command<K, T>) =>
    pipe(
      c.parseArgs(argv, rawArgs),
      T.flatMap((args) =>
        pipe(
          args,
          O.match({
            onNone: () => T.succeed({}),
            onSome: c.executeCommand(context),
          })
        )
      ),
      T.mapError((e) =>
        O.some({
          message: `error running command ${c.name}`,
          cause: e,
        })
      )
    );

pipe(
  initialize,
  T.flatMap((context) => {
    const yargParsedArgs = pipe(
      Commands,
      A.reduce(yargs(hideBin(process.argv)), (y, c) => c.addCommand(y))
    )
      .command("help", "view this help message")
      .scriptName("gbt");

    const parsedArgsV = yargParsedArgs.argv;

    return pipe(
      Commands,
      T.forEach(handleCommand(context, parsedArgsV, parsedArgsV._))
    );
  }),
  (e) =>
    T.runCallback(
      e,
      matchTag({
        Failure: (err) => {
          console.error("Error", JSON.stringify(err, null, 2));
        },
        Success: (v) => {
          console.log("Done in 0.0s", v.value);
        },
      })
    )
);

const printCircular = (deps: readonly PackageJson[]): string => {
  const depsWithoutRecursive = pipe(deps, A.take(deps.length - 1));
  return pipe(
    deps,
    A.reverse,
    A.head,
    O.map((h) => ({ recursiveDep: h })),
    O.bind("rIndex", ({ recursiveDep }) =>
      pipe(
        depsWithoutRecursive,
        A.findFirstIndex((d) => d.name === recursiveDep.name)
      )
    ),
    O.map(({ recursiveDep, rIndex }) => {
      const [before, after] = pipe(deps, A.splitAt(rIndex));

      const afterWithoutRecursive = pipe(after, A.take(after.length - 1));

      const beforeStrs = before.map((p) => `   ${p.name}`).join("\n    │\n");

      const afterStrs = afterWithoutRecursive
        .map(
          (p, i) =>
            `${
              i === 0
                ? "╭─ "
                : i === afterWithoutRecursive.length - 1
                ? "╰─ "
                : "│  "
            }${p.name}`
        )
        .join("\n│   │\n");

      return beforeStrs + "\n    │\n" + afterStrs;
    }),
    O.getOrElse(() => "")
  );
};
