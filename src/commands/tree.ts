import { pipe } from "@effect-ts/core/Function";

import * as O from "@effect-ts/core/Option";
import * as A from "@effect-ts/core/Array";
import * as T from "@effect-ts/core/Effect";
import { Command } from "./Command";
import { FS } from "../system/FS";
import path from "path";
import { PackageJson } from "../core/PackageJson";

export const TreeCommand: Command<'tree', {}> = {
  addCommand: yargs => yargs
    .command('tree', 'view a dependency tree of the workspaces in the project'),
  parseArgs: (argv, rawArgs) => pipe(
      A.head(rawArgs),
      T.fromOption,
      T.chain(command => {
        console.log('command is:', command)
        return command === 'tree' ? T.succeed({_type: 'tree' as const}) : T.fail({})
      })
    ),
  executeCommand: (context) => (args) => {
    console.log('executing request!!', path.join(process.cwd(), 'report'))
    console.log(JSON.stringify(context, null, 2))
    return pipe(
      FS.mkdir(path.join(process.cwd(), 'report')),
      T.chain(() =>
        FS.writeFile(path.join(process.cwd(), 'report', 'workspaces.puml'), plantUmlGraph(context.workspaces).join("\n") )
      ),
      T.map(() => 'wtf')
    )
  }
  
}

const plantUmlGraph = (workspaces: A.Array<{
  dir: string;
  package: PackageJson;
  localDeps: A.Array<PackageJson>;
}>): A.Array<string> =>
  pipe(
    workspaces,
    A.map(workspace => ({workspace})),
    A.bind('localDep', ({workspace}) => workspace.localDeps),
    A.map(({workspace, localDep}) => `(${workspace.package.name}) --> (${localDep.name})`)
  )
