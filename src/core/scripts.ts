import { pipe } from "effect/Function";
import { PackageJson } from "./PackageJson";
import * as O from "effect/Option";
import * as A from "effect/ReadonlyArray";
import * as R from "effect/ReadonlyRecord";
import * as T from "effect/Effect";
import { PS } from "../system/PS";

export const runScript = (p: PackageJson) => (command: string) =>
  pipe(
    p,
    getCommand(command),
    T.flatMap((cmd) => PS.spawn(p.name)("yarn")(["workspace", p.name, command]))
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
