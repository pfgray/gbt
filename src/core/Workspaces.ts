import * as S from "@effect/schema/Schema";

export const WorkspacesC = S.union(
  S.array(S.string),
  S.struct({
    packages: S.array(S.string),
    nohoist: S.optional(S.array(S.string)),
  })
);

export type WorkspacesT = S.Schema.To<typeof WorkspacesC>;

export const workspaceGlobs = (
  workspaces: WorkspacesT
): ReadonlyArray<string> =>
  "packages" in workspaces
    ? [...workspaces.packages, ...(workspaces.nohoist || [])]
    : workspaces;
