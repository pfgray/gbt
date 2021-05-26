import { pipe } from "@effect-ts/core/Function";

import * as O from "@effect-ts/core/Option";
import * as A from "@effect-ts/core/Array";
import * as T from "@effect-ts/core/Effect";
import { Command } from "./Command";

export const TreeCommand: Command<'tree', {}> = {
  addCommand: yargs => yargs
  .command('tree', 'view a dependency tree of the workspaces in the project'),
  parseArgs: (argv, rawArgs) =>
  pipe(
    A.head(rawArgs),
    T.fromOption,
    T.chain(command => command === 'tree' ? T.fail({}) : T.succeed({_type: 'tree' as const}))
  ),
  executeCommand: () => () => T.effectTotal(() => {
    console.log('TODO: implement tree');
  })
}
