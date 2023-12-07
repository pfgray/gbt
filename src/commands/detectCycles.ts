import { flow, pipe } from "effect/Function";
import * as A from "effect/ReadonlyArray";
import * as O from "effect/Option";
import * as T from "effect/Effect";
import { Command } from "./Command";
import { AppWithDeps, findPackage } from "../core/AppWithDeps";
import { PackageJson, packageJsonEqual } from "../core/PackageJson";
import { fromCompare, ordString } from "effect/Ord";
import { Equal } from "@effect-ts/system/Equal";
import { eqString } from "effect/Equal";
import { renderDotGraphSvg } from "./tree";
import { FS } from "../system/FS";
import path from "path";

export const DetectCyclesCommand: Command<"detect-cycles", {}> = {
  name: "detect-cycles",
  addCommand: (yargs) =>
    yargs.command("detect-cycles", "Find and report cycles"),
  parseArgs: (argv, rawArgs) =>
    pipe(
      A.head(rawArgs),
      T.fromOption,
      T.flatMap((command) =>
        command === "detect-cycles"
          ? T.succeed(O.some({ _type: "detect-cycles" as const }))
          : T.succeed(O.none)
      )
    ),
  executeCommand: (context) => (args) =>
    //  for each workspace, find a cycle
    //
    pipe(
      context.workspaces,
      A.flatMap(detectCycles(context.workspaces)),
      A.uniq(cycleEq),

      A.map(renderGraphCycle),
      T.succeed,
      T.tap((lines) =>
        T.effectTotal(() => {
          console.log(lines.join("\n"));
        })
      ),
      T.map(renderDigraph),
      T.tap((dot) =>
        FS.writeFile(path.join(process.cwd(), "report", "cycles.dot"), dot)
      ),
      T.flatMap(renderDotGraphSvg),
      T.flatMap((svg) =>
        FS.writeFile(path.join(process.cwd(), "report", "cycles.svg"), svg)
      )
    ),
};

type Cycle = readonly PackageJson[];

const cycleEq: Equal<Cycle> = {
  equals: (a) => (b) => {
    const sort = flow(
      A.map((p: PackageJson) => p.name),
      A.sort(ordString)
    );
    return A.getEqual(eqString).equals(sort(a))(sort(b));
  },
};

const detectCycles =
  (workspaces: readonly AppWithDeps[]) => (workspace: AppWithDeps) => {
    const detectCyclesInner =
      (seenPackages: Array<PackageJson>) =>
      (workspace: AppWithDeps): readonly Cycle[] =>
        workspace.localDeps.length === 0
          ? []
          : pipe(seenPackages, A.elem(packageJsonEqual)(workspace.package))
          ? [formatCycle(seenPackages, workspace.package)]
          : pipe(
              workspace.localDeps,
              A.flatMap((p) =>
                pipe(
                  p,
                  findPackage(workspaces),
                  O.fold(
                    () => [],
                    detectCyclesInner([...seenPackages, workspace.package])
                  )
                )
              )
            );
    return detectCyclesInner([])(workspace);
  };

const formatCycle = (
  seenPackages: A.Array<PackageJson>,
  pkg: PackageJson
): Cycle =>
  pipe(
    seenPackages,
    A.findIndex((p) => p.name === pkg.name),
    O.fold(
      () => [],
      (indexOfLoopedPkg) => {
        const subLoop = pipe(seenPackages, A.splitAt(indexOfLoopedPkg))[1];
        return [...subLoop, pkg];
      }
    )
  );

const renderGraphCycle = (cycle: Cycle): string =>
  pipe(
    cycle,
    A.map((a) => `"${a.name}"`),
    A.join(" -> ")
  );

const renderDigraph = (lines: string[]) => `strict digraph G {
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
     \n ${lines.join("\n")} \n}`;
