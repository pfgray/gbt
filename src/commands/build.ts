import { pipe } from "@effect-ts/core/Function";

import * as O from "@effect-ts/core/Option";
import * as A from "@effect-ts/core/Array";
import * as T from "@effect-ts/core/Effect";
import { Command } from "./Command";
import { runScript } from "../core/scripts";
import { mkPackagesState } from "../core/packagesState";
import { AppWithDeps, appWithDepsEqual, findPackage, findPackageByName } from "../core/AppWithDeps";
import { trace, traceN } from "../core/debug";
import { PackageJson, packageJsonEqual } from "../core/PackageJson";
import { ConsoleE, ConsoleEnv } from "../core/ConsoleEnv";
import { StdoutConsoleEnv } from "../cli/StdoutConsoleEnv";
import { mkFileLogEnv } from "../cli/FileLogEnv";

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
      T.fromOption,
      trace("parsing build args", rawArgs),
      T.chain((command) =>
        command === "build"
          ? T.succeed({ _type: "build" as const })
          : T.fail({})
      ),
      trace("parsed build", argv, rawArgs),
      T.bind("package", () =>
        pipe(
          argv.package,
          O.fromNullable,
          O.chain((u) => (typeof u === "string" ? O.some(u) : O.none)),
          traceN("got package", 1),
          T.fromOption
        )
      ),
      T.option
    ),
  executeCommand: (context) => (options) => {
    return pipe(
      options.package,
      findPackageByName(context.workspaces),
      T.fromOption,
      T.mapError(() => ({
        _type: 'Error',
        message: `Can't find package ${options.package}`
      })),
      T.chain(rootPackage => {

        const tree = pipe(
          rootPackage,
          packagesInTree(context.workspaces),
        )

        // return T.effectTotal(() => {
        //   console.log(`For package ${rootPackage.package.name}, found:`)
        //   tree.forEach(t => {
        //     console.log(t.package.name)
        //   })
        // })


        const {
          runCommandInApp,
          buildPackage
        } = mkPackagesState(tree, rootPackage, mkFileLogEnv('./.gbt.log'))

        return pipe(
          tree,
          A.filter(a => a.localDeps.length === 0),
          A.map(a => a.package),
          T.forEach(buildPackage({buildRoot: true}))
        )

        // return pipe(
        //   rootPackage,
        //   findAllLeafPackages(context.workspaces),
        //   T.forEach(buildPackage),
        // )

      }),
      T.provide(StdoutConsoleEnv)
  )}
};

const packagesInTree = (workspaces: A.Array<AppWithDeps>) => (pkg: AppWithDeps): A.Array<AppWithDeps> =>
  pipe(
    pkg.localDeps,
    A.filterMap(findPackage(workspaces)),
    A.chain(packagesInTree(workspaces)),
    A.concat([pkg]),
    A.uniq(appWithDepsEqual)
  )

const findAllLeafPackages = (workspaces: A.Array<AppWithDeps>) => (pkg: AppWithDeps): A.Array<PackageJson> =>
  pkg.localDeps.length === 0 ? [pkg.package] : pipe(
    pkg.localDeps,
    A.filterMap(findPackage(workspaces)),
    A.chain(findAllLeafPackages(workspaces)),
    A.uniq(packageJsonEqual)
  )
