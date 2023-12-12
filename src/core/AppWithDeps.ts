import { identity, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as E from "effect/Either";
import * as A from "effect/ReadonlyArray";
import { PackageJson, packageJsonEqual } from "./PackageJson";
import { Effect, Either, Order } from "effect";

export type AppWithDeps = {
  dir: string;
  package: PackageJson;
  localDeps: ReadonlyArray<PackageJson>;
  localDependents: ReadonlyArray<PackageJson>;
};

const circularDep = (context: ReadonlyArray<PackageJson>) => ({
  _tag: "CircularDepFound" as const,
  context,
});

export const findDeps =
  (
    allPackages: ReadonlyArray<AppWithDeps>,
    parentContext: ReadonlyArray<PackageJson>
  ) =>
  (
    p: AppWithDeps
  ): E.Either<ReturnType<typeof circularDep>, Array<AppWithDeps>> => {
    return pipe(
      parentContext,
      A.findFirst((a) => a.name === p.package.name),
      O.match({
        onNone: () =>
          pipe(p.localDeps, A.filterMap(findPackage(allPackages)), (deps) =>
            pipe(
              deps,
              A.map(findDeps(allPackages, parentContext.concat(p.package))),
              (a) => a,
              Effect.allWith(),
              (b) => b,
              E.map(A.flatMap(identity)),
              E.map((ds) => [...deps, ...ds])
            )
          ) as E.Either<ReturnType<typeof circularDep>, Array<AppWithDeps>>,
        onSome: () => E.left(circularDep([...parentContext, p.package])),
      })
    );
  };

A.makeBy(1, () => 4);

export const findParents =
  (
    allPackages: ReadonlyArray<AppWithDeps>,
    childContext: ReadonlyArray<PackageJson>
  ) =>
  (
    p: AppWithDeps
  ): E.Either<ReturnType<typeof circularDep>, ReadonlyArray<AppWithDeps>> => {
    return pipe(
      childContext,
      A.findFirst((a) => a.name === p.package.name),
      O.match({
        onNone: () =>
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
                Either.all,
                Either.map(A.flatMap(identity))
              )
          ),
        onSome: () => E.left(circularDep(childContext)),
      })
    );
  };

export const findPackage =
  (allPackages: ReadonlyArray<AppWithDeps>) => (p: PackageJson) =>
    findPackageByName(allPackages)(p.name);

export const findPackageByName =
  (allPackages: ReadonlyArray<AppWithDeps>) => (name: string) =>
    pipe(
      allPackages,
      A.findFirst((w) => w.package.name === name)
    );

export const appWithDepsLocalDepsOrdering = pipe(
  Order.number,
  Order.mapInput((a: AppWithDeps) => a.localDeps.length)
);
export const appWithDepsLocalDependentsOrdering = pipe(
  Order.number,
  Order.mapInput((a: AppWithDeps) => a.localDependents.length)
);

export const appWithDepsFormativeOrdering = Order.combine(
  appWithDepsLocalDepsOrdering
)(Order.reverse(appWithDepsLocalDependentsOrdering));

export const appWithDepsTotalDepsOrdering = pipe(
  Order.number,
  Order.mapInput(
    (a: AppWithDeps) => a.localDependents.length + a.localDeps.length
  ),
  Order.reverse
);

export const appWithDepsDepRatioOrdering = pipe(
  Order.number,
  Order.mapInput((a: AppWithDeps) =>
    Math.abs(a.localDependents.length - a.localDeps.length)
  )
);

export const appWithDepsEqual = (a: AppWithDeps, b: AppWithDeps) =>
  a.package.name === b.package.name;

export const appWithDepsPainfulOrdering = Order.combine(
  appWithDepsDepRatioOrdering
)(appWithDepsTotalDepsOrdering);
