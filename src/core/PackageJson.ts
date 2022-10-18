import { literal, pipe } from "@effect-ts/core/Function";
import { Equal } from "@effect-ts/core/Equal";
import * as t from "io-ts";
import * as T from "@effect-ts/core/Effect";
import * as E from "fp-ts/lib/Either";
import reporter from "io-ts-reporters";
import { WorkspacesC } from "./Workspaces";

export const PackageJsonC = t.intersection([
  t.type({
    name: t.string,
  }),
  t.partial({
    version: t.string,
    dependencies: t.record(t.string, t.string),
    devDependencies: t.record(t.string, t.string),
    peerDependencies: t.record(t.string, t.string),
    workspaces: WorkspacesC,
    scripts: t.record(t.string, t.string),
    src: t.string,
  }),
]);

export type PackageJsonT = t.TypeOf<typeof PackageJsonC>;
export interface PackageJson extends PackageJsonT {}

export const packageJsonEqual: Equal<PackageJson> = {
  equals: (a) => (b) => a.name === b.name,
};

export const parsePackageJson = (packagePath: string) => (contents: string) =>
  pipe(
    T.fromEither<t.Errors, PackageJson>(() =>
      PackageJsonC.decode(JSON.parse(contents))
    ),
    T.mapError((errs) => ({
      _tag: literal("ParsePackageJsonError"),
      //errors: errs,
      parsedError: reporter.report(E.left(errs)),
      packageJsonPath: packagePath,
    }))
  );
