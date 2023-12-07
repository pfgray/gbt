import * as T from "effect/Effect";
import * as A from "effect/ReadonlyArray";
import * as O from "effect/Option";
import yargs from "yargs";
import { PackageJson } from "../core/PackageJson";
import { AppWithDeps } from "../core/AppWithDeps";

export type Command<K extends string, T extends object> = {
  name: K;
  addCommand(y: yargs.Argv<{}>): yargs.Argv<{}>;
  parseArgs: (
    argv: Record<string, unknown>,
    rawArgs: Array<string | number>
  ) => T.Effect<unknown, unknown, O.Option<{ _type: K } & T>>;
  executeCommand: (context: {
    rootProject: {
      root: PackageJson;
    };
    workspaces: A.Array<AppWithDeps>;
  }) => (t: T) => T.Effect<unknown, unknown, unknown>;
};
