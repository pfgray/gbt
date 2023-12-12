import * as T from "effect/Effect";
import { identity, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as A from "effect/ReadonlyArray";
import * as ROA from "effect/ReadonlyArray";
import * as R from "effect/ReadonlyRecord";
import { getSecond } from "effect/Tuple";
import * as path from "path";
import { FS } from "../system/FS";
import { AppWithDeps, findDeps } from "./AppWithDeps";
import { PackageJson, packageJsonEqual, parsePackageJson } from "./PackageJson";
import { workspaceGlobs } from "./Workspaces";

const tap =
  (s: string) =>
  <A>(a: A): A => {
    console.log(s, a);
    return a;
  };

const packageIsAssignableTo =
  (name: string) => (version: string) => (p: PackageJson) =>
    name === p.name; //&& version === p.version;

const resolveProject = (dir: string) =>
  pipe(path.join(dir, "package.json"), (pJson) =>
    pipe(FS.readFile(pJson), T.flatMap(parsePackageJson(pJson)))
  );

const parseProject = (dir: string) =>
  pipe(
    FS.lstat(dir),
    T.flatMap((stat) => (stat.isDirectory() ? T.succeed(stat) : T.fail(0))),
    T.mapError(() => ({ _tag: "PackageIsNotDir" as const, dir })),
    T.flatMap((stat) =>
      pipe(
        resolveProject(dir),
        T.map(O.some),
        T.orElse(() => T.succeed(O.none()))
      )
    ),
    T.map((p) => [dir, p] as const)
  );

/**
 * For a given root project, find the workspaces present
 */
const findWorkspaces = (root: PackageJson, dir: string) =>
  pipe(
    O.fromNullable(root.workspaces),
    T.mapError(() => ({ _tag: "NoWorkspaces" as const, dir, root })),
    T.map((w) => {
      return { workspaceGlobs: workspaceGlobs(w) };
    }),
    T.bind("workspaceDirs", ({ workspaceGlobs }) => {
      return pipe(
        workspaceGlobs,
        A.map((s) => (s.endsWith("/") ? s : `${s}/`)),
        T.forEach(FS.glob)
      );
    }),
    T.bind("packages", ({ workspaceDirs }) => {
      return pipe(
        workspaceDirs,
        A.flatMap(identity),
        T.forEach(parseProject),
        T.map(
          A.filterMap(([p, pkgOp]) =>
            pipe(
              pkgOp,
              O.map((pkg) => [p, pkg] as const)
            )
          )
        )
      );
    }),
    T.map(({ packages }) =>
      pipe(
        packages,
        A.map(([dir, p]) => {
          return {
            dir,
            package: p,
            localDeps: pipe(
              [p.dependencies, p.devDependencies, p.peerDependencies],
              A.filterMap(O.fromNullable),
              A.reduce({} as Record<string, string>, (z, a) =>
                Object.assign({}, a, z)
              ),
              (a) => a,
              R.filterMap((version, name) =>
                pipe(
                  packages,
                  A.map(getSecond),
                  ROA.findFirst(packageIsAssignableTo(name)(version))
                )
              ),
              R.toEntries,
              A.map(getSecond)
            ),
          };
        }),
        (workspaces) => {
          return workspaces.map((workspace) => {
            const localDependents = pipe(
              workspaces,
              A.filter((w) =>
                pipe(
                  w.localDeps,
                  A.containsWith(packageJsonEqual)(workspace.package)
                )
              ),
              A.map((w) => w.package)
            );
            return { ...workspace, localDependents };
          });
        }
      )
    )
  );

export const initialize = pipe(
  T.succeed({}),
  T.bind("rootProject", () => resolveProject(process.cwd())),
  T.bind("workspaces", ({ rootProject }) => {
    return pipe(findWorkspaces(rootProject, path.dirname(process.cwd())));
  })
);

const checkCircular = (options: {
  workspaces: ReadonlyArray<AppWithDeps>;
  rootApp: AppWithDeps;
}) => findDeps(options.workspaces, [])(options.rootApp);
