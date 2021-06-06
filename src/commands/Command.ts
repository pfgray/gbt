import * as T from "@effect-ts/core/Effect";
import * as A from "@effect-ts/core/Array";
import * as O from "@effect-ts/core/Option";
import yargs from "yargs";
import { PackageJson } from "../core/PackageJson";

export type Command<K extends string, T extends object> = {
  addCommand(y: yargs.Argv<{}>): yargs.Argv<{}>;
  parseArgs: (
    argv: Record<string, unknown>,
    rawArgs: Array<string | number>
  ) => T.Effect<unknown, unknown, O.Option<{ _type: K } & T>>;
  executeCommand: (context: {
    rootProject: {
      root: PackageJson;
    };
    workspaces: A.Array<{
      dir: string;
      package: PackageJson;
      localDeps: A.Array<PackageJson>;
    }>;
  }) => (t: T) => T.Effect<unknown, unknown, unknown>;
};
