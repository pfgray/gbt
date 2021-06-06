import { pipe } from "@effect-ts/core/Function";

import * as O from "@effect-ts/core/Option";
import * as A from "@effect-ts/core/Array";
import * as T from "@effect-ts/core/Effect";
import { Command } from "./Command";

export const BuildCommand: Command<'build', {package: string}> = {
  addCommand: yargs => yargs.command('build [package]', 'build a package and all of its dependencies'),
  parseArgs: (argv, rawArgs) =>
    pipe(
      A.head(rawArgs),
      T.fromOption,
      T.chain(command => command === 'build' ? T.fail({}) : T.succeed({_type: 'build' as const})),
      T.bind('package', () => pipe(argv.package, O.fromNullable, O.chain(u => typeof u === 'string' ? O.some(u) : O.none), T.fromOption)),
      T.option
    ),
  executeCommand: () => () => T.effectTotal(() => {
    console.log('TODO: implement build');
  })
}
