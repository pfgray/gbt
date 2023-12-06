#!/usr/bin/env node
import * as A from "@effect-ts/core/Array";
import * as NEA from "@effect-ts/core/NonEmptyArray";
import * as O from "@effect-ts/core/Option";
import * as T from "@effect-ts/core/Effect";
import { fromOption } from "@effect-ts/core/Effect";
import { literal, pipe } from "@effect-ts/core/Function";
import { render } from "ink";
import * as React from "react";
import { makeMatchers } from "ts-adt/MakeADT";
import { PackageJson } from "../core/PackageJson";
import { mkPackagesState } from "../core/packagesState";
import { initialize } from "../core/intialize";
import { PackageList } from "./PackageList";
import { hideBin } from "yargs/helpers";
import { ADT } from "ts-adt";
import { BuildCommand } from "../commands/build";
import { TreeCommand } from "../commands/tree";
import { StartCommand } from "../commands/start";
import yargs from "yargs";
import { ListCommand } from "../commands/list";
import { PackageDirsCommand } from "../commands/packageDirs";
import { VersionCommand } from "../commands/version";
import { Command } from "../commands/Command";
import { StatsCommand } from "../commands/stats";
import { FindCommand } from "../commands/find";
import { AppWithDeps } from "../core/AppWithDeps";
import { DetectCyclesCommand } from "../commands/detectCycles";

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
      rootProject: {
        root: PackageJson;
      };
    } & {
      workspaces: A.Array<AppWithDeps>;
    },
    argv: Record<string, unknown>,
    rawArgs: (string | number)[]
  ) =>
  <K extends string, T extends object>(c: Command<K, T>) =>
    pipe(
      c.parseArgs(argv, rawArgs),
      T.chain((args) =>
        pipe(
          args,
          O.fold(() => T.succeed({}), c.executeCommand(context))
        )
      ),
      T.refineOrDie((e) =>
        O.some({
          message: `error running command ${c.name}`,
          cause: e,
        })
      )
    );

pipe(
  initialize,
  T.chain((context) => {
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
    T.run(
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
  const depsWithoutRecursive = pipe(deps, A.takeLeft(deps.length - 1));
  return pipe(
    deps,
    A.reverse,
    NEA.fromArray,
    O.map(NEA.head),
    O.map((h) => ({ recursiveDep: h })),
    O.bind("rIndex", ({ recursiveDep }) =>
      pipe(
        depsWithoutRecursive,
        A.findIndex((d) => d.name === recursiveDep.name)
      )
    ),
    O.map(({ recursiveDep, rIndex }) => {
      const [before, after] = pipe(deps, A.splitAt(rIndex));

      const afterWithoutRecursive = pipe(after, A.takeLeft(after.length - 1));

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
