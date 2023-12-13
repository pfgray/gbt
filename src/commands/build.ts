import { pipe } from "effect/Function";

import * as O from "effect/Option";
import * as A from "effect/ReadonlyArray";
import * as T from "effect/Effect";
import { Command } from "./Command";
import { runScript } from "../core/scripts";
import {
  AppWithDeps,
  appWithDepsEqual,
  findPackage,
  findPackageByName,
} from "../core/AppWithDeps";
import { trace, traceN } from "../core/debug";
import { PackageJson, packageJsonEqual } from "../core/PackageJson";
import { Reporter } from "../core/console/Reporter";
import { StdoutReporter } from "../core/console/StdoutReporter";
import { mkFileLogEnv } from "../core/logger/FileLogger";
import { mkPackagesState } from "../core/packagesState/packagesStateAtom";
import { mkConsoleLogger } from "../core/logger/ConsoleLogger";

export const BuildCommand: Command<"build", { package: string }> = {
  name: "build",
  addCommand: (yargs) =>
    yargs.command(
      "build [package]",
      "build a package and all of its dependencies"
    ),
  parseArgs: (argv, rawArgs) =>
    pipe(
      A.head(rawArgs),
      T.flatMap((command) =>
        command === "build"
          ? T.succeed({ _type: "build" as const })
          : T.fail({})
      ),
      T.bind("package", () =>
        pipe(
          argv.package,
          O.fromNullable,
          O.flatMap((u) => (typeof u === "string" ? O.some(u) : O.none()))
        )
      ),
      T.option
    ),
  executeCommand: (context) => (options) => {
    return pipe(
      options.package,
      findPackageByName(context.workspaces),
      // T.fromOption,
      T.mapError(() => ({
        _type: "Error",
        message: `Can't find package ${options.package}`,
      })),
      T.flatMap((rootPackage) => {
        const tree = pipe(rootPackage, packagesInTree(context.workspaces));

        const { runCommandInApp, buildPackage } = pipe(
          mkPackagesState(tree, rootPackage),
          T.provide(mkConsoleLogger()),
          T.runSync
        );

        return pipe(
          tree,
          (a) => a,
          A.filter((a) => a.localDeps.length === 0),
          A.map((a) => a.package),
          T.forEach(buildPackage({ buildRoot: true }))
        );
      }),
      T.provide(StdoutReporter)
    );
  },
};

const packagesInTree =
  (workspaces: ReadonlyArray<AppWithDeps>) =>
  (pkg: AppWithDeps): ReadonlyArray<AppWithDeps> =>
    pipe(
      pkg.localDeps,
      A.filterMap(findPackage(workspaces)),
      A.flatMap(packagesInTree(workspaces)),
      A.appendAll([pkg]),
      A.dedupeWith(appWithDepsEqual)
    );

const findAllLeafPackages =
  (workspaces: ReadonlyArray<AppWithDeps>) =>
  (pkg: AppWithDeps): ReadonlyArray<PackageJson> =>
    pkg.localDeps.length === 0
      ? [pkg.package]
      : pipe(
          pkg.localDeps,
          A.filterMap(findPackage(workspaces)),
          A.flatMap(findAllLeafPackages(workspaces)),
          A.dedupeWith(packageJsonEqual)
        );
