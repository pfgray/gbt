import { pipe } from "effect/Function";

import * as O from "effect/Option";
import * as A from "effect/ReadonlyArray";
import * as T from "effect/Effect";
import { Command } from "./Command";
import { FS } from "../system/FS";
import path from "path";
import { PackageJson } from "../core/PackageJson";
import { exec } from "child_process";

const tap =
  (...msg: unknown[]): (<T>(t: T) => T) =>
  (t) => {
    console.log(...msg);
    return t;
  };

export const TreeCommand: Command<"tree", { focus: O.Option<string> }> = {
  name: "tree",
  addCommand: (yargs) =>
    yargs
      .command(
        "tree",
        "view a dependency tree of the workspaces in the project"
      )
      .option("focus", {
        alias: "f",
        type: "string",
      }),
  parseArgs: (argv, rawArgs) =>
    pipe(
      rawArgs,
      A.head,
      T.flatMap((command) =>
        command === "tree"
          ? T.succeed(
              O.some({
                _type: "tree" as const,
                focus: pipe(
                  O.fromNullable(argv.focus),
                  O.filter((p): p is string => typeof p === "string"),
                  O.filter((p) => p !== "")
                ),
              })
            )
          : T.succeed(O.none())
      )
    ),
  executeCommand: (context) => (args) =>
    pipe(
      FS.mkdir(path.join(process.cwd(), "report")),
      T.flatMap(() => {
        const graph = pipe(context.workspaces, generateDotGraph(args.focus));
        console.log(graph);
        return T.zip(
          FS.writeFile(
            path.join(process.cwd(), "report", "workspaces.dot"),
            graph
          )
        )(
          pipe(
            renderDotGraphSvg(graph),
            T.flatMap((svg) =>
              FS.writeFile(
                path.join(process.cwd(), "report", "workspaces.svg"),
                svg
              )
            )
          )
        );
      })
    ),
};

const generateDotGraph =
  (focus: O.Option<string>) =>
  (
    workspaces: ReadonlyArray<{
      dir: string;
      package: PackageJson;
      localDeps: ReadonlyArray<PackageJson>;
    }>
  ): string =>
    pipe(
      workspaces,
      workspacesWithLocalDeps,
      A.filter(({ workspace, localDep }) =>
        pipe(
          focus,
          O.match({
            onNone: () => true,
            onSome: (focusedPackage) =>
              workspace.package.name === focusedPackage ||
              localDep.name === focusedPackage,
          })
        )
      ),
      A.map(
        ({ workspace, localDep }) =>
          `"${workspace.package.name}" -> "${localDep.name}"`
      ),
      A.join("\n"),
      (lines) => `digraph G {
      bgcolor="#002b36"
      node [
          shape=box,
          color="#93a1a1"
          style="rounded",
          fontcolor="#93a1a1",
          penwidth=2
          fontname="Helvetica"
      ];
      edge [
          color="#cb4b16",
          penwidth=2
      ]
       \n ${lines} \n}`
    );

const workspacesWithLocalDeps = (
  workspaces: ReadonlyArray<{
    dir: string;
    package: PackageJson;
    localDeps: ReadonlyArray<PackageJson>;
  }>
) =>
  pipe(
    workspaces,
    A.flatMap((workspace) =>
      pipe(
        workspace.localDeps,
        A.map((localDep) => ({
          workspace,
          localDep,
        }))
      )
    )
  );

const plantUmlGraph = (
  workspaces: ReadonlyArray<{
    dir: string;
    package: PackageJson;
    localDeps: ReadonlyArray<PackageJson>;
  }>
): ReadonlyArray<string> =>
  pipe(
    workspaces,
    workspacesWithLocalDeps,
    A.map(
      ({ workspace, localDep }) =>
        `(${workspace.package.name}) --> (${localDep.name})`
    )
  );

export const renderDotGraphSvg = (graph: string) =>
  T.async<
    never,
    { _tag: "GraphvizError"; error?: unknown; stderr?: unknown },
    string
  >((cb) => {
    exec(`echo '${graph}' | dot -Tsvg`, (error, stdout, stderr) => {
      if (error) {
        cb(T.fail({ _tag: "GraphvizError" as const, error }));
      } else if (stderr) {
        cb(T.fail({ _tag: "GraphvizError" as const, stderr: stderr }));
      } else {
        cb(T.succeed(stdout));
      }
    });
  });

// T.sync(() => {});
// T.effectAsync<unknown, { _tag: "GraphvizError"; graph: string }, string>(
//   (cb) => {
//     graphviz
//       .dot(graph, "svg")
//       .then((svg) => {
//         cb(T.succeed(svg));
//       })
//       .catch(() => {
//         cb(T.fail({ _tag: "GraphvizError"), graph }) as const;
//       });
//   }
// );
