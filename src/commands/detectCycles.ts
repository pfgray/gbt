import { Equivalence, Order } from "effect";
import * as T from "effect/Effect";
import { flow, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as A from "effect/ReadonlyArray";
import path from "path";
import { AppWithDeps, findPackage } from "../core/AppWithDeps";
import { PackageJson, packageJsonEqual } from "../core/PackageJson";
import { FS } from "../system/FS";
import { Command } from "./Command";
import { renderDotGraphSvg } from "./tree";

export const DetectCyclesCommand: Command<"detect-cycles", {}> = {
  name: "detect-cycles",
  addCommand: (yargs) =>
    yargs.command("detect-cycles", "Find and report cycles"),
  parseArgs: (argv, rawArgs) =>
    pipe(
      A.head(rawArgs),
      T.flatMap((command) =>
        command === "detect-cycles"
          ? T.succeed(O.some({ _type: "detect-cycles" as const }))
          : T.succeed(O.none())
      )
    ),
  executeCommand: (context) => (args) =>
    //  for each workspace, find a cycle
    //
    pipe(
      context.workspaces,
      A.flatMap(detectCycles(context.workspaces)),
      A.dedupeWith(cycleEq),
      A.map(renderGraphCycle),
      T.succeed,
      T.tap((lines) =>
        T.sync(() => {
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

const arraysEqual =
  <A>(compare: (a: A, b: A) => boolean) =>
  (a: ReadonlyArray<A>, b: ReadonlyArray<A>) => {
    if (a === b) return true;
    if (a.length !== b.length) return false;

    for (var i = 0; i < a.length; ++i) {
      if (!compare(a[i], b[i])) return false;
    }
    return true;
  };

const cycleEq: Equivalence.Equivalence<Cycle> = Equivalence.make((a, b) => {
  const sort = flow(
    A.map((p: PackageJson) => p.name),
    A.sort(Order.string)
  );
  return A.getEquivalence(Equivalence.string)(sort(a), sort(b));
});

const detectCycles =
  (workspaces: readonly AppWithDeps[]) => (workspace: AppWithDeps) => {
    const detectCyclesInner =
      (seenPackages: Array<PackageJson>) =>
      (workspace: AppWithDeps): readonly Cycle[] =>
        workspace.localDeps.length === 0
          ? []
          : pipe(
              seenPackages,
              A.containsWith(packageJsonEqual)(workspace.package)
            )
          ? [formatCycle(seenPackages, workspace.package)]
          : pipe(
              workspace.localDeps,
              A.flatMap((p) =>
                pipe(
                  p,
                  findPackage(workspaces),
                  O.match({
                    onNone: A.empty,
                    onSome: detectCyclesInner([
                      ...seenPackages,
                      workspace.package,
                    ]),
                  })
                )
              )
            );
    return detectCyclesInner([])(workspace);
  };

const formatCycle = (
  seenPackages: ReadonlyArray<PackageJson>,
  pkg: PackageJson
): Cycle =>
  pipe(
    seenPackages,
    A.findFirstIndex((p) => p.name === pkg.name),
    O.match({
      onNone: A.empty,
      onSome: (indexOfLoopedPkg) => {
        const subLoop = pipe(seenPackages, A.splitAt(indexOfLoopedPkg))[1];
        return [...subLoop, pkg];
      },
    })
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
