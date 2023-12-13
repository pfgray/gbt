import { pipe } from "effect/Function";
import * as A from "effect/ReadonlyArray";
import * as O from "effect/Option";
import * as T from "effect/Effect";
import { Command } from "./Command";
import { packageJsonEqual } from "../core/PackageJson";
import { Ordering } from "effect/Ordering";
import {
  AppWithDeps,
  appWithDepsDepRatioOrdering,
  appWithDepsFormativeOrdering,
  appWithDepsPainfulOrdering,
  appWithDepsTotalDepsOrdering,
} from "../core/AppWithDeps";

export const StatsCommand: Command<"stats", {}> = {
  name: "stats",
  addCommand: (yargs) => yargs.command("stats", "list package statistics"),
  parseArgs: (argv, rawArgs) =>
    pipe(
      A.head(rawArgs),
      T.flatMap((command) =>
        command === "stats"
          ? T.succeed(O.some({ _type: "stats" as const }))
          : T.succeed(O.none())
      )
    ),
  executeCommand: (context) => (args) =>
    T.sync(() => {
      context.workspaces.forEach((w) => {
        console.log(`${w.package.name}:`);
        console.log(`  ${w.localDeps.length} local dependencies`);
        console.log(`  ${w.localDependents.length} local dependents`);
      });

      const formative = pipe(
        context.workspaces,
        A.sort(appWithDepsFormativeOrdering),
        A.take(5)
      );

      const painful = pipe(
        context.workspaces,
        A.sort(appWithDepsTotalDepsOrdering),
        A.take(30),
        A.sort(appWithDepsDepRatioOrdering),
        A.take(5)
      );

      console.log("Most formative packages:");
      formative.forEach(printWorkspaceDepCount);

      console.log("Most painful packages:");
      painful.forEach(printWorkspaceDepCount);
    }),
};

const printWorkspaceDepCount = (w: AppWithDeps) => {
  console.log(
    `  ${w.package.name} (Dependencies: ${w.localDeps.length}, Dependendents: ${w.localDependents.length})`
  );
};
