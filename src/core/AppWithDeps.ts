import { identity, literal, pipe } from "@effect-ts/core/Function";
import * as O from "@effect-ts/core/Option";
import * as E from "@effect-ts/core/Either";
import * as A from "@effect-ts/core/Array";
import { PackageJson } from "./PackageJson";
import {
  Ord,
  fromCompare,
  ordNumber,
  contramap,
  getAssociative,
  dual,
  ordString,
  OrdURI,
} from "@effect-ts/core/Ord";

export type AppWithDeps = {
  dir: string;
  package: PackageJson;
  localDeps: ReadonlyArray<PackageJson>;
  localDependents: ReadonlyArray<PackageJson>;
};

const circularDep = (context: ReadonlyArray<PackageJson>) => ({
  _tag: literal("CircularDepFound"),
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

export const findParents =
  (
    allPackages: ReadonlyArray<AppWithDeps>,
    childContext: ReadonlyArray<PackageJson>
  ) =>
  (
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

export const findPackage =
  (allPackages: ReadonlyArray<AppWithDeps>) => (p: PackageJson) =>
    pipe(
      allPackages,
      A.findFirst((w) => w.package.name === p.name)
    );

export const appWithDepsLocalDepsOrdering = pipe(
  ordNumber,
  contramap((a: AppWithDeps) => a.localDeps.length)
);
export const appWithDepsLocalDependentsOrdering = pipe(
  ordNumber,
  contramap((a: AppWithDeps) => a.localDependents.length)
);

export const appWithDepsFormativeOrdering =
  getAssociative<AppWithDeps>().combine(appWithDepsLocalDepsOrdering)(
    dual(appWithDepsLocalDependentsOrdering)
  );

export const appWithDepsTotalDepsOrdering = pipe(
  ordNumber,
  contramap((a: AppWithDeps) => a.localDependents.length + a.localDeps.length),
  dual
);

export const appWithDepsDepRatioOrdering = pipe(
  ordNumber,
  contramap((a: AppWithDeps) =>
    Math.abs(a.localDependents.length - a.localDeps.length)
  )
  // dual
);

export const appWithDepsPainfulOrdering = getAssociative<AppWithDeps>().combine(
  appWithDepsDepRatioOrdering
)(appWithDepsTotalDepsOrdering);

// {
//   compare: a => b =>
// }

// const ageOrd = Ord.contramap((a) => a.age)(Ord.ordNumber);
// const nameOrd = Ord.contramap((a) => a.name)(Ord.ordString);

// const user1 = { name: "a", age: 3 };
// const user2 = { name: "b", age: 0 };
// const user3 = { name: "c", age: 1 };
// const user4 = { name: "c", age: 2 };

// // A.sort(getAssociative().combine(ageOrd)(dual(nameOrd)))([user1, user2, user3, user4])
// getAssociative().combine(ageOrd)(nameOrd);
