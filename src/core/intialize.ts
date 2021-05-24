import * as T from "@effect-ts/core/Effect";
import * as path from "path";
import * as O from "@effect-ts/core/Option";
import yargs from "yargs/yargs";
import { FS } from "../system/FS";
import { literal, pipe, tuple } from "@effect-ts/core/Function";
import {
  PackageJson,
  parsePackageJson,
} from "./PackageJson";
import { Refinement } from "@effect-ts/core/Function";
import * as ROA from "fp-ts/lib/ReadonlyArray";
import * as R from "@effect-ts/core/Record";
import * as A from "@effect-ts/core/Array";
import { snd } from "fp-ts/lib/Tuple";
import { AppWithDeps, findDeps } from "./AppWithDeps";
import { hideBin } from 'yargs/helpers'

const isString = (u: unknown): u is string => typeof u === "string";

const fromPredicate = <A, B extends A>(refinement: Refinement<A, B>) => (
  a: A
) => T.fromOption(O.fromPredicate(refinement)(a));

const errorParsingArgument = (arg: string) => (args: unknown) => ({
  _tag: literal("ParseArgsError"),
  arg,
  args,
});

const packageIsAssignableTo = (name: string) => (version: string) => (
  p: PackageJson
) => name === p.name && version === p.version;

const parseArguments = () => {
  const args = yargs(process.argv).argv;

  yargs(hideBin(process.argv))
    .command('build [package]', 'build a package and all of its dependencies')
    .command('start [package]', 'start a package and, and optionally watch all of its dependencies')
    .boolean('watch-deps')
    .argv

  return pipe(
    args,
    T.succeed,
    T.map((argv) => ({ argv })),
    T.bind("rootP", ({ argv }) =>
      pipe(
        O.fromPredicate(isString)(argv["root"]),
        T.succeed,
        T.someOrElse(() => ".")
      )
    ),
    T.bind("app", ({ argv }) =>
      pipe(
        fromPredicate(isString)(argv["app"]),
        T.mapError(() => errorParsingArgument("app")(args))
      )
    )
  );
};

const resolveProject = (dir: string) =>
  pipe(path.join(dir, "package.json"), (pJson) =>
    pipe(FS.readFile(pJson), T.chain(parsePackageJson(pJson)))
  );

const parseProject = (dir: string) =>
  pipe(
    FS.lstat(dir),
    T.chain((stat) => (stat.isDirectory() ? T.succeed(stat) : T.fail(0))),
    T.mapError(() => ({ _tag: "PackageIsNotDir" as const, dir })),
    T.chain((stat) => resolveProject(dir)),
    T.map((p) => tuple(dir, p))
  );

/**
 * For a given root project, find the workspaces present
 */
const findWorkspaces = (root: PackageJson, dir: string) =>
  pipe(path.join(dir, "packages"), (packagesDir) =>
    pipe(
      FS.readDir(packagesDir),
      T.mapError(() => ({ _tag: "PackagesDirNotFound" as const, dir, root })),
      T.bind("packages", (pkg) =>
        pipe(
          pkg,
          A.map((a) => path.join(packagesDir, a)),
          T.forEach(parseProject)
        )
      ),
      T.map(({ packages }) =>
        pipe(
          packages,
          A.map(([dir, p]) => {
            return {
              dir,
              package: p,
              localDeps: pipe(
                p.dependencies,
                O.fromNullable,
                O.getOrElse<Record<string, string>>(() => ({})),
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
    )
  );

export const initialize = pipe(
  parseArguments(),
  T.bind("context", ({ rootP }) =>
    T.structPar({
      root: resolveProject(path.dirname(rootP)),
    })
  ),
  T.bind("workspaces", ({ rootP, context }) =>
    pipe(
      findWorkspaces(context.root, path.dirname(rootP)),
      T.map(A.filter((w) => w.package.name !== "server"))
    )
  ),
  T.bind("rootApp", ({ workspaces, app }) =>
    T.fromOption(
      pipe(
        workspaces,
        A.findFirst((w) => w.package.name === app)
      )
    )
  ),
  T.tap(({ workspaces, rootApp }) => checkCircular({ workspaces, rootApp }))
);

const checkCircular = (options: {
  workspaces: ReadonlyArray<AppWithDeps>;
  rootApp: AppWithDeps;
}) => {
  return T.fromEither(() => findDeps(options.workspaces, [])(options.rootApp));
};
