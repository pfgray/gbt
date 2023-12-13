import { pipe } from "effect/Function";
import { Equal } from "effect/Equal";
import * as S from "@effect/schema/Schema";
import * as T from "effect/Effect";
import * as E from "effect/Either";
import * as TreeFormatter from "@effect/schema/TreeFormatter";
import { WorkspacesC } from "./Workspaces";

export const PackageJsonC = S.struct({
  name: S.string,
  version: S.optional(S.string),
  dependencies: S.optional(S.record(S.string, S.string)),
  devDependencies: S.optional(S.record(S.string, S.string)),
  peerDependencies: S.optional(S.record(S.string, S.string)),
  workspaces: S.optional(WorkspacesC),
  scripts: S.optional(S.record(S.string, S.string)),
  src: S.optional(S.string),
  engines: S.optional(S.record(S.string, S.string)),
});

export type PackageJsonT = S.Schema.To<typeof PackageJsonC>;
export interface PackageJson extends PackageJsonT {}

export const packageJsonEqual = (a: PackageJson, b: PackageJson) =>
  a.name === b.name;

export const parsePackageJson = (packagePath: string) => (contents: string) =>
  pipe(
    S.parse(PackageJsonC)(JSON.parse(contents), { onExcessProperty: "ignore" }),
    T.mapError((errs) => ({
      _tag: "ParsePackageJsonError" as const,
      parsedError: TreeFormatter.formatErrors(errs.errors),
      packageJsonPath: packagePath,
    }))
  );
