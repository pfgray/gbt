import { literal, pipe } from "@effect-ts/core/Function";

import * as O from "@effect-ts/core/Option";
import * as A from "@effect-ts/core/Array";
import * as T from "@effect-ts/core/Effect";
import { Command } from "./Command";
import { render } from "ink";
import React from "react";
import { PackageList } from "../cli/PackageList";
import { PackageJson } from "../core/PackageJson";
import { mkPackagesState } from "../core/packagesState";
import { traceN } from "../core/debug";

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
      T.fromOption,
      T.chain((command) =>
        command === "start"
          ? T.succeed({ _type: "start" as const })
          : T.fail({})
      ),
      T.bind("package", () =>
        pipe(
          argv.package,
          O.fromNullable,
          O.chain((u) => (typeof u === "string" ? O.some(u) : O.none)),
          T.fromOption
        )
      ),
      T.bind("watchDeps", () =>
        pipe(
          argv.watchDependencies,
          O.fromNullable,
          O.chain((u) => (typeof u === "boolean" ? O.some(u) : O.none)),
          T.fromOption
        )
      ),
      T.option
    ),
  executeCommand: (context) => (args) =>
    pipe(
      T.do,
      T.bind("appPackageJson", (a) =>
        pipe(
          context.workspaces,
          A.findFirst((w) => w.package.name === args.package),
          T.fromOption,
          T.mapError(() => ({
            _tag: literal("InitialAppNotFound"),
            appName: args.package,
          }))
        )
      ),
      T.bind("reactApp", ({ appPackageJson }) => {
        return renderApp(
          context.workspaces,
          mkPackagesState(context.workspaces, appPackageJson),
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
  appState: ReturnType<typeof mkPackagesState>,
  rootApp: PackageJson
) =>
  T.effectAsync<unknown, never, number>((cb) => {
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
