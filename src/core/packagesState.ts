import * as T from "effect/Effect";
import * as F from "effect/Fiber";
import { identity, pipe } from "effect/Function";
import * as O from "effect/Option";
import { Fiber } from "effect/Fiber";
import { newAtom } from "frp-ts/lib/atom";
import { newCounterClock } from "frp-ts/lib/clock";
import { runScript } from "./scripts";
import { PackageJson } from "./PackageJson";
import { Lens, Prism, fromTraversable, Traversal } from "monocle-ts";
import { array } from "effect/ReadonlyArray";
import * as A from "effect/ReadonlyArray";
import * as E from "effect/Either";
import * as path from "path";
import { AppWithDeps, findDeps, findPackage, findParents } from "./AppWithDeps";
import { WatchE } from "../system/WatchEnv";
import { trace } from "./debug";
import { StdoutConsoleEnv } from "../cli/StdoutConsoleEnv";
import { ConsoleEnv } from "./ConsoleEnv";
import { LogEnv } from "./LogEnv";

export type AppState =
  | "starting"
  | "started"
  | "watching"
  | "building"
  | "inactive"
  | "waiting";
export type AppWithProcess = {
  app: AppWithDeps;
  build: O.Option<Fiber<unknown, unknown>>;
  watch: O.Option<Fiber<unknown, unknown>>;
  state: AppState;
};
export type PackagesState = {
  rootApp: AppWithDeps;
  workspaces: Array<AppWithProcess>;
  dependencies: Array<AppWithDeps>;
  killed: boolean;
};

const workspacesL = Lens.fromProp<PackagesState>()("workspaces");
export const killedL = Lens.fromProp<PackagesState>()("killed");

const appWithProcessT = fromTraversable(array)<AppWithProcess>();
const getAppPrism = (name: string): Prism<AppWithProcess, AppWithProcess> =>
  Prism.fromPredicate((app) => app.app.package.name === name);

const getFirst = <A, B>(t: Traversal<A, B>) => (a: A): O.Option<B> =>
  pipe(t.asFold().getAll(a), A.head);

const getAppTraversal = (
  name: string
): Traversal<PackagesState, AppWithProcess> =>
  workspacesL.composeTraversal(appWithProcessT).composePrism(getAppPrism(name));

const buildPsL = (name: string) =>
  getAppTraversal(name).composeLens(Lens.fromProp<AppWithProcess>()("build"));
const watchPsL = (name: string) =>
  getAppTraversal(name).composeLens(Lens.fromProp<AppWithProcess>()("watch"));
const stateL = (name: string) =>
  getAppTraversal(name).composeLens(Lens.fromProp<AppWithProcess>()("state"));

// Perhaps we should just export Effects that require ConsoleEnv, instead of requiring one here?

export const mkPackagesState = (
  workspaces: ReadonlyArray<AppWithDeps>,
  rootApp: AppWithDeps,
  logEnv: LogEnv
) => {
  const dependencies = pipe(
    findDeps(workspaces, [])(rootApp),
    E.match({
      onLeft: () => [] as Array<AppWithDeps>,
      onRight: identity
    })
  );

  const atom = newAtom({ clock: newCounterClock() })<PackagesState>({
    dependencies,
    rootApp,
    killed: false,
    workspaces: workspaces.map((app) => ({
      app,
      build: O.none,
      watch: O.none,
      state: "inactive",
    })),
  });

  atom.subscribe({
    next:() => {
      logEnv.logger.debug('Got new state: ', atom.get())
    }
  })

  const killApp = (p: PackageJson) => {
    return pipe(
      atom.get(),
      
      getFirst(getAppTraversal(p.name)),
      O.fold(
        () => T.succeed(0),
        (a) =>
          pipe(
            [a.build, a.watch],
            T.forEachPar(O.fold(() => T.succeed(0 as unknown), F.interrupt))
          )
      ),
      T.flatMap(() =>
        T.effectTotal(() => {
          atom.modify(buildPsL(p.name).modify(() => O.none));
        })
      )
    );
  };

  const runCommandInApp = (
    p: PackageJson,
    command: string,
    onComplete: T.UIO<unknown>
  ) => {
    return pipe(
      runScript(p)(command),
      T.flatMap(() =>
        T.effectTotal(() => {
          atom.modify(buildPsL(p.name).modify(() => O.none));
        })
      ),
      T.flatMap(() => onComplete),
      T.fork,
      T.flatMap((f) =>
        T.effectTotal(() => {
          atom.modify(buildPsL(p.name).modify(() => O.some(f)));
        })
      ),
    );
  };

  const buildPackage = (options: {buildRoot: boolean}) => (p: PackageJson): T.Effect<ConsoleEnv, never, unknown> => {
    // don't build if a dependency is building
    const depIsBuilding = pipe(
      findPackage(workspaces)(p),
      O.map(findDeps(workspaces, [])),
      O.flatMap(O.fromEither),
      O.fold(() => [] as Array<AppWithDeps>, identity),
      A.findFirstMap((d) => {
        const buildingPackage = pipe(
          getFirst(stateL(d.package.name))(atom.get()),
          O.filter((s) => s === "building")
        )
        if(O.isSome(buildingPackage)) {
          console.log(`not building ${p.name} because ${d.package.name} is building`)
          console.log(`  ${d.package.name}'s dependents are:`)
          console.log(`  ${d.localDependents.map(d => d.name).join(', ')}`)
        }
        return buildingPackage
        }),
      O.isSome
    );
    return depIsBuilding
      ? T.succeed(0)
      : pipe(
          T.do,
          T.bind("pkg", () => T.fromOption(findPackage(workspaces)(p))),
          T.tap(({ pkg }) =>
            T.effectTotal(() => {
              // update all parents to 'waiting'
              const parentUpdates = pipe(
                findParents(workspaces, [])(pkg),
                O.fromEither,
                O.fold(
                  () => [] as Array<(s: PackagesState) => PackagesState>,
                  A.map((p) => stateL(p.package.name).modify(() => "waiting"))
                ),
                A.reduce(
                  identity as (s: PackagesState) => PackagesState,
                  (f, g) => (p) => f(g(p))
                )
              );

              const updates = (s: PackagesState) =>
                stateL(p.name).modify(() => "building")(parentUpdates(s));

              atom.modify(updates);
            })
          ),
          T.tap(({ pkg }) =>
            runCommandInApp(
              p,
              "build",
              pipe(
                T.effectTotal(() => {
                  atom.modify(stateL(p.name).modify(() => "watching"));
                }),
                T.tap(() =>
                  pipe(
                    T.fromEither(() => findParents(workspaces, [])(pkg)),
                    T.map(A.map((p) => p.package)),
                    T.map(A.filter((p) => 
                       options.buildRoot || p.name !== rootApp.package.name
                    )),
                    T.flatMap(T.forEach(buildPackage(options))),
                    T.orElse(() => T.succeed(0))
                  )
                )
              )
            )
          ),
          T.orElse(() => T.succeed(0))
        );
  };

  const startApp = (p: PackageJson) => {
    // start the app...
    return pipe(
      T.do,
      T.bind("pkg", () =>
        T.fromOption(findPackage(atom.get().workspaces.map((a) => a.app))(p))
      ),
      T.bind("app", () =>
        pipe(
          runCommandInApp(p, "start", T.none),
          T.tap(() =>
            T.effectTotal(() => {
              atom.modify(stateL(p.name).modify(() => "started"));
            })
          )
        )
      ),
      T.bind("children", ({ pkg }) => {
        return pipe(
          T.fromEither(() =>
            findDeps(
              atom.get().workspaces.map((a) => a.app),
              []
            )(pkg)
          ),
          T.flatMap(
            T.forEach((d) => {
              const src = d.package.src ?? "src";
              const watchDir = path.join(process.cwd(), d.dir, src);
              // if we're already watching this package, don't setup another one

              return pipe(
                atom.get().workspaces,
                A.findFirst((w) => w.app.package.name === d.package.name),
                O.filter((p) => O.isSome(p.watch)),
                O.fold(
                  () =>
                    pipe(
                      WatchE.dir(watchDir, () => {
                        console.log('source change detected in', watchDir)
                        console.log('rebuilding', d.package.name)
                        return pipe(buildPackage({buildRoot: false})(d.package), T.provide(StdoutConsoleEnv))
                      }),
                      trace('watching dir:', watchDir),
                      T.fork,
                      T.flatMap((f) =>
                        T.effectTotal(() => {
                          atom.modify((s) =>
                            watchPsL(d.package.name).modify(() => O.some(f))(
                              stateL(d.package.name).modify(() => "watching")(s)
                            )
                          );
                        })
                      )
                    ),
                  () => T.effectTotal(() => {})
                )
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
};
