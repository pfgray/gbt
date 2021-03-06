import * as T from "@effect-ts/core/Effect";
import * as path from "path";
import * as O from "@effect-ts/core/Option";
import * as Ass from '@effect-ts/core/Associative';
import yargs from "yargs/yargs";
import { FS } from "../system/FS";
import { identity, literal, pipe, tuple } from "@effect-ts/core/Function";
import { PackageJson, parsePackageJson } from "./PackageJson";
import { Refinement } from "@effect-ts/core/Function";
import * as ROA from "fp-ts/lib/ReadonlyArray";
import * as R from "@effect-ts/core/Record";
import * as A from "@effect-ts/core/Array";
import { snd } from "fp-ts/lib/Tuple";
import { AppWithDeps, findDeps } from "./AppWithDeps";
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
    pipe(FS.readFile(pJson), T.chain(parsePackageJson(pJson)))
  );

const parseProject = (dir: string) =>
  pipe(
    FS.lstat(dir),
    T.chain((stat) => (stat.isDirectory() ? T.succeed(stat) : T.fail(0))),
    T.mapError(() => ({ _tag: "PackageIsNotDir" as const, dir })),
    T.chain((stat) =>
      pipe(
        resolveProject(dir),
        T.map(O.some),
        T.orElse(() => T.succeed(O.none)),
      )
    ),
    T.map((p) => tuple(dir, p))
  );

/**
 * For a given root project, find the workspaces present
 */
const findWorkspaces = (root: PackageJson, dir: string) =>
  pipe(
    O.fromNullable(root.workspaces),
    T.fromOption,
    T.mapError(() => ({ _tag: "NoWorkspaces" as const, dir, root })),
    T.map((w) => ({ workspaceGlobs: workspaceGlobs(w) })),
    T.bind("workspaceDirs", ({ workspaceGlobs }) =>
      pipe(
        workspaceGlobs,
        A.map((s) => (s.endsWith("/") ? s : `${s}/`)),
        T.forEach(FS.glob)
      )
    ),
    T.bind("packages", ({ workspaceDirs }) => {
      return pipe(
        workspaceDirs,
        A.chain(identity),
        T.forEach(parseProject),
        T.map(
          A.filterMap(([p, pkgOp]) =>
            pipe(
              pkgOp,
              O.map((pkg) => tuple(p, pkg))
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
              A.foldMap(R.getIdentity(Ass.first<string>()))(a => a),
              R.filterMapWithIndex((name, version) =>
                pipe(
                  packages,
                  A.map(snd),
                  ROA.findFirst(packageIsAssignableTo(name)(version))
                )
              ),
              R.toArray,
              A.map(snd),
              (hmm) => hmm
            ),
          };
        })
      )
    )
  );

export const initialize = pipe(
  T.succeed({}),
  T.bind("rootProject", ({}) =>
    T.structPar({
      root: resolveProject(process.cwd()),
    })
  ),
  T.bind("workspaces", ({ rootProject }) =>
    pipe(
      findWorkspaces(rootProject.root, path.dirname(process.cwd())),
      T.map(A.filter((w) => w.package.name !== "server"))
    )
  )
);

const checkCircular = (options: {
  workspaces: ReadonlyArray<AppWithDeps>;
  rootApp: AppWithDeps;
}) => {
  return T.fromEither(() => findDeps(options.workspaces, [])(options.rootApp));
};
