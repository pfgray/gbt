import { identity, literal, pipe } from "@effect-ts/core/Function";
import * as O from "@effect-ts/core/Option";
import * as E from "@effect-ts/core/Either";
import * as A from "@effect-ts/core/Array";
import { PackageJson } from "./PackageJson";

export type AppWithDeps = {
  dir: string;
  package: PackageJson;
  localDeps: ReadonlyArray<PackageJson>;
};

const circularDep = (context: ReadonlyArray<PackageJson>) => ({
  _tag: literal("CircularDepFound"),
  context,
});

export const findDeps = (
  allPackages: ReadonlyArray<AppWithDeps>,
  parentContext: ReadonlyArray<PackageJson>
) => (
  p: AppWithDeps
): E.Either<ReturnType<typeof circularDep>, Array<AppWithDeps>> => {
  return pipe(
    parentContext,
    A.findFirst((a) => a.name === p.package.name),
    O.fold(
      () =>
        pipe(p.localDeps, A.filterMap(findPackage(allPackages)), (deps) =>
          pipe(
            deps,
            A.map(findDeps(allPackages, parentContext.concat(p.package))),
            A.sequence(E.Applicative),
            E.map(A.chain(identity)),
            E.map((ds) => [...deps, ...ds])
          )
        ),
      () => E.left(circularDep([...parentContext, p.package]))
    )
  );
};

export const findParents = (
  allPackages: ReadonlyArray<AppWithDeps>,
  childContext: ReadonlyArray<PackageJson>
) => (
  p: AppWithDeps
): E.Either<ReturnType<typeof circularDep>, Array<AppWithDeps>> => {
  return pipe(
    childContext,
    A.findFirst((a) => a.name === p.package.name),
    O.fold(
      () =>
        pipe(
          allPackages,
          A.filter((a) =>
            pipe(
              a.localDeps,
              A.findFirst((d) => d.name === p.package.name),
              O.isSome
            )
          ),
          (parents) =>
            pipe(
              parents,
              A.map(findParents(allPackages, childContext.concat(p.package))),
              A.sequence(E.Applicative),
              E.map(A.chain(identity)),
              E.map((ps) => [...parents, ...ps])
            )
        ),
      () => E.left(circularDep(childContext))
    )
  );
};

export const findPackage = (allPackages: ReadonlyArray<AppWithDeps>) => (
  p: PackageJson
) =>
  pipe(
    allPackages,
    A.findFirst((w) => w.package.name === p.name)
  );
