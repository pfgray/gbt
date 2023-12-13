import { pipe } from "effect/Function";
import { PackageJson } from "./PackageJson";
import * as O from "effect/Option";
import * as A from "effect/ReadonlyArray";
import * as R from "effect/ReadonlyRecord";
import * as T from "effect/Effect";
import { PS } from "../system/PS";
import { GbtContext } from "../commands/Command";

const runYarnScript = (p: PackageJson) => (command: string) =>
  PS.spawn(p.name)("yarn")(["workspace", p.name, command]);
const runPnpmScript = (p: PackageJson) => (command: string) =>
  PS.spawn(p.name)("pnpm")(["--filter", p.name, command]);
const runNpmScript = (p: PackageJson) => (command: string) =>
  PS.spawn(p.name)("npm")(["run", command, "-w", p.name]);

export const runScript =
  (context: GbtContext, p: PackageJson) => (command: string) =>
    pipe(
      p,
      getCommand(command),
      T.flatMap((_cmd) => {
        return context.rootProject.engines?.pnpm
          ? runPnpmScript(p)(command)
          : context.rootProject.engines?.yarn
          ? runYarnScript(p)(command)
          : runNpmScript(p)(command);
      })
    );

const getCommand = (command: string) => (p: PackageJson) =>
  pipe(
    O.fromNullable(p.scripts),
    O.map(R.toEntries),
    O.flatMap(A.findFirst(([s]) => s === command)),
    (a) => a,
    T.mapError(() => ({
      _tag: "CommandNotFound" as const,
      package: p,
      command,
    })),
    T.map(([, command]) => command)
  );
