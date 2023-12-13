import {
  Effect,
  Either,
  Exit,
  Fiber,
  Layer,
  Option,
  Order,
  ReadonlyArray,
  flow,
  identity,
  pipe,
} from "effect";
import {
  AppWithDeps,
  findDeps,
  findDirectParents,
  findPackage,
  findParents,
} from "../AppWithDeps";
import { Logger, LoggerService } from "../logger/Logger";
import { mkAtom } from "../atom/atom";
import { AppWithProcess, PackagesState } from "./PackagesState";
import { PackageJson } from "../PackageJson";
import * as T from "effect/Effect";
import {
  PackagesStateModifier,
  setAppBuildProcess,
  setAppState,
  setAppWatchProcess,
} from "./packagesStateModifiers";
import { runScript } from "../scripts";
import { Reporter } from "../console/Reporter";
import { tapSync } from "../lib/effectExtras";
import * as path from "path";
import { Watch } from "../../system/watch/Watch";
import { StdoutReporter } from "../console/StdoutReporter";
import { mkFileLogEnv } from "../logger/FileLogger";
import { atom } from "frp-ts";
import { NonEmptyReadonlyArray } from "effect/ReadonlyArray";
import { trace } from "../debug";

const renderPackages = (state: PackagesState) => {
  const renderPackage = (longestName: number) => (pkg: AppWithProcess) => {
    return `${pkg.app.package.name.padEnd(longestName + 3, ".")}${pkg.state}`;
  };
  const longestName = pipe(
    state.workspaces,
    ReadonlyArray.map((w) => w.app.package.name.length),
    ReadonlyArray.match({
      onEmpty: () => 0,
      onNonEmpty: ReadonlyArray.max(Order.number),
    }),
    (a) => a
  );
  return pipe(state.workspaces, ReadonlyArray.map(renderPackage(longestName)));
};

export const mkPackagesState = (
  workspaces: ReadonlyArray<AppWithDeps>,
  rootApp: AppWithDeps
  // logger: Layer.Layer<never, never, Logger>
) =>
  LoggerService.pipe(
    Effect.map((logger) => {
      const dependencies = pipe(
        findDeps(workspaces, [])(rootApp),
        Either.match({
          onLeft: () => [] as Array<AppWithDeps>,
          onRight: identity,
        })
      );

      const atom = mkAtom<PackagesState>({
        dependencies,
        rootApp,
        killed: false,
        workspaces: workspaces.map((app) => ({
          app,
          build: Option.none(),
          watch: Option.none(),
          state: "inactive",
        })),
      });

      // atom.subscribe(() => {
      //   logger.debug("Got new state:");
      //   logger.debug(`\n  ${renderPackages(atom.get()).join("\n  ")}`);
      // });

      const killApp = (p: PackageJson) => {
        return pipe(
          atom.get().workspaces,
          ReadonlyArray.findFirst((a) => a.app.package.name === p.name),
          Option.match({
            onNone: () => T.succeed(0),
            onSome: (a) =>
              pipe(
                [a.build, a.watch],
                T.forEach(
                  Option.match({
                    onNone: () => T.succeed(0 as unknown),
                    onSome: Fiber.interrupt,
                  })
                )
              ),
          }),
          atom.tapModify(() => setAppBuildProcess(p.name)(Option.none()))
        );
      };

      const runCommandInApp = <R, E>(
        p: PackageJson,
        command: string,
        onComplete: T.Effect<R, E, unknown>
      ) => {
        return pipe(
          runScript(p)(command),
          atom.tapModify(() => setAppBuildProcess(p.name)(Option.none())),
          T.flatMap(() => onComplete),
          T.forkDaemon,
          atom.tapModify((process) => {
            return setAppBuildProcess(p.name)(Option.some(process));
          })
        );
      };

      const buildPackage =
        (options: { buildRoot: boolean }) =>
        (p: PackageJson): T.Effect<Reporter, never, unknown> => {
          // don't build if a dependency is building
          const depIsBuildingOrWaiting = pipe(
            findPackage(workspaces)(p),
            (a) => a,
            Option.match({
              onNone: ReadonlyArray.empty,
              onSome: flow(
                findDeps(workspaces, []),
                Either.match({
                  onLeft: ReadonlyArray.empty,
                  onRight: identity,
                })
              ),
            }),
            ReadonlyArray.filterMap((d) => {
              const buildingPackage = pipe(
                atom.get().workspaces,
                ReadonlyArray.findFirst(
                  (a) => a.app.package.name === d.package.name
                ),
                Option.filter(
                  (s) => s.state === "building" || s.state === "waiting"
                )
              );
              return buildingPackage;
            }),
            ReadonlyArray.isNonEmptyArray
          );
          return depIsBuildingOrWaiting
            ? T.succeed(0)
            : pipe(
                T.Do,
                T.bind("pkg", () => findPackage(workspaces)(p)),
                tapSync(({ pkg }) => {
                  const parentUpdates = pipe(
                    findParents(workspaces, [])(pkg),
                    Either.match({
                      onLeft: () =>
                        ReadonlyArray.empty<PackagesStateModifier>(),
                      onRight: ReadonlyArray.map((p) =>
                        setAppState(p.package.name)("waiting")
                      ),
                    })
                  );

                  const updates = [
                    ...parentUpdates,
                    setAppState(p.name)("building"),
                  ];

                  atom.modifyNow(...updates);
                }),
                (a) => a,
                T.tap(({ pkg }) =>
                  runCommandInApp(
                    p,
                    "build",
                    pipe(
                      atom.modify(setAppState(p.name)("watching")),
                      T.tap(() =>
                        pipe(
                          findDirectParents(workspaces, [])(pkg),
                          T.map(ReadonlyArray.map((p) => p.package)),
                          T.map(
                            ReadonlyArray.filter(
                              (p) =>
                                options.buildRoot ||
                                p.name !== rootApp.package.name
                            )
                          ),
                          T.flatMap(T.forEach(buildPackage(options))),
                          T.orElse(() => T.succeed(0))
                        )
                      )
                    )
                  )
                ),
                (a) => a,
                T.mapError((err) => {
                  console.log("err? ", err);
                  return err;
                }),
                T.orElse(() => T.succeed(0))
              );
        };

      const startApp = (p: PackageJson) => {
        // start the app...
        return pipe(
          T.Do,
          T.bind("pkg", () =>
            findPackage(atom.get().workspaces.map((a) => a.app))(p)
          ),
          T.bind("app", () =>
            pipe(
              runCommandInApp(p, "start", T.succeed(0)),
              atom.tapModify(() => setAppState(p.name)("started"))
            )
          ),
          T.bind("children", ({ pkg }) => {
            return pipe(
              findDeps(
                atom.get().workspaces.map((a) => a.app),
                []
              )(pkg),
              T.flatMap(
                T.forEach((d) => {
                  const src = d.package.src ?? "src";
                  const watchDir = path.join(process.cwd(), d.dir, src);
                  // if we're already watching this package, don't setup another one

                  return pipe(
                    atom.get().workspaces,
                    ReadonlyArray.findFirst(
                      (w) => w.app.package.name === d.package.name
                    ),
                    Option.filter((p) => Option.isSome(p.watch)),
                    Option.match({
                      onNone: () =>
                        pipe(
                          Watch.dir(watchDir, () => {
                            logger.debug("source change detected in", watchDir);
                            logger.debug("rebuilding", d.package.name);
                            return pipe(
                              buildPackage({ buildRoot: false })(d.package),
                              T.provide(StdoutReporter)
                            );
                          }),
                          T.fork,
                          atom.tapModifyL((f) => [
                            setAppWatchProcess(d.package.name)(Option.some(f)),
                            setAppState(d.package.name)("watching"),
                          ])
                        ),
                      onSome: () => T.sync(() => {}),
                    })
                  );
                })
              )
            );
          })
        );
      };

      return {
        atom,
        killApp,
        buildPackage,
        runCommandInApp,
        startApp,
      };
    })
  );
