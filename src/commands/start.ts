import { pipe } from "effect/Function";

import * as O from "effect/Option";
import * as A from "effect/ReadonlyArray";
import * as T from "effect/Effect";
import { Command } from "./Command";
import { render } from "ink";
import React from "react";
import { PackageList } from "../cli/PackageList";
import { PackageJson } from "../core/PackageJson";
import { traceN } from "../core/debug";
import { mkPackagesState } from "../core/packagesState/packagesStateAtom";
import { mkFileLogEnv } from "../core/logger/FileLogger";

export const StartCommand: Command<
  "start",
  { package: string; watchDeps: boolean }
> = {
  name: "start",
  addCommand: (yargs) =>
    yargs.command(
      "start [package]",
      "start a package and optionally watch all of its dependencies",
      {
        watchDependencies: {
          alias: "w",
          default: true,
        },
      }
    ),
  parseArgs: (argv, rawArgs) =>
    pipe(
      A.head(rawArgs),
      T.flatMap((command) =>
        command === "start"
          ? T.succeed({ _type: "start" as const })
          : T.fail({})
      ),
      T.bind("package", () =>
        pipe(
          argv.package,
          O.fromNullable,
          O.flatMap((u) => (typeof u === "string" ? O.some(u) : O.none()))
        )
      ),
      T.bind("watchDeps", () =>
        pipe(
          argv.watchDependencies,
          O.fromNullable,
          O.flatMap((u) => (typeof u === "boolean" ? O.some(u) : O.none()))
        )
      ),
      T.option
    ),
  executeCommand: (context) => (args) =>
    pipe(
      T.Do,
      T.bind("appPackageJson", (a) =>
        pipe(
          context.workspaces,
          A.findFirst((w) => w.package.name === args.package),
          T.mapError(() => ({
            _tag: "InitialAppNotFound" as const,
            appName: args.package,
          }))
        )
      ),
      T.bind("reactApp", ({ appPackageJson }) => {
        return renderApp(
          context.workspaces,
          pipe(
            mkPackagesState(context, appPackageJson),
            T.provide(mkFileLogEnv("./gbt.log")),
            T.runSync
          ),
          appPackageJson.package
        );
      })
    ),
};

const renderApp = (
  apps: ReadonlyArray<{
    package: PackageJson;
    localDeps: ReadonlyArray<PackageJson>;
  }>,
  appState: T.Effect.Success<ReturnType<typeof mkPackagesState>>,
  rootApp: PackageJson
) =>
  T.async<number, never, never>((cb) => {
    const exit = () => cb(T.succeed(0));
    render(
      React.createElement(PackageList, {
        workspaces: apps,
        exit,
        packagesState: appState,
        rootApp,
      })
    );
  });
