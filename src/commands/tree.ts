import { literal, pipe } from "@effect-ts/core/Function";

import * as O from "@effect-ts/core/Option";
import * as A from "@effect-ts/core/Array";
import * as T from "@effect-ts/core/Effect";
import { Command } from "./Command";
import { FS } from "../system/FS";
import path from "path";
import { PackageJson } from "../core/PackageJson";
import { graphviz } from 'node-graphviz'


export const TreeCommand: Command<"tree", {}> = {
  addCommand: (yargs) =>
    yargs.command(
      "tree",
      "view a dependency tree of the workspaces in the project"
    ),
  parseArgs: (argv, rawArgs) =>
    pipe(
      A.head(rawArgs),
      T.fromOption,
      T.chain((command) =>
        command === "tree" ? T.succeed(O.some({ _type: "tree" as const })) : T.succeed(O.none)
      )
    ),
  executeCommand: (context) => (args) =>
    pipe(
      FS.mkdir(path.join(process.cwd(), "report")),
      T.chain(() => {
        
        const graph = pipe(context.workspaces, dotGraph);
        console.log(graph);

        return T.zip(
          FS.writeFile(
            path.join(process.cwd(), "report", "workspaces.dot"),
            pipe(
              graph,
            )
          ))(
            pipe(
              renderDotGraph(graph),
              T.chain(svg => FS.writeFile(
                path.join(process.cwd(), "report", "workspaces.svg"),
                svg
              ))
            )
        );
      })
    ),
};

const dotGraph = (
  workspaces: A.Array<{
    dir: string;
    package: PackageJson;
    localDeps: A.Array<PackageJson>;
  }>
): string =>
  pipe(
    workspaces,
    A.map((workspace) => ({ workspace })),
    A.bind("localDep", ({ workspace }) => workspace.localDeps),
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

const plantUmlGraph = (
  workspaces: A.Array<{
    dir: string;
    package: PackageJson;
    localDeps: A.Array<PackageJson>;
  }>
): A.Array<string> =>
  pipe(
    workspaces,
    A.map((workspace) => ({ workspace })),
    A.bind("localDep", ({ workspace }) => workspace.localDeps),
    A.map(
      ({ workspace, localDep }) =>
        `(${workspace.package.name}) --> (${localDep.name})`
    )
  );

const renderDotGraph = (graph: string) =>
  T.effectAsync<unknown, { _tag: "GraphvizError"; graph: string }, string>(cb => {
    graphviz.dot(graph, 'svg').then((svg) => {
      cb(T.succeed(svg));
    }).catch(() => {
      cb(T.fail({ _tag: literal("GraphvizError"), graph }))
    });
  })

