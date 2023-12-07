import * as t from "@effect/schema/Schema";

export const WorkspacesC = t.union([
  t.array(t.string),
  t.intersection([
    t.type({
      packages: t.array(t.string),
    }),
    t.partial({
      nohoist: t.array(t.string),
    }),
  ]),
]);

export type WorkspacesT = t.TypeOf<typeof WorkspacesC>;

export const workspaceGlobs = (workspaces: WorkspacesT): Array<string> =>
  Array.isArray(workspaces)
    ? workspaces
    : [...workspaces.packages, ...(workspaces.nohoist || [])];
