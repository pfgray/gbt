#!/usr/bin/env node
import * as A from "@effect-ts/core/Array";
import * as NEA from "@effect-ts/core/NonEmptyArray";
import * as O from "@effect-ts/core/Option";
import * as T from "@effect-ts/core/Effect";
import { fromOption } from "@effect-ts/core/Effect";
import { literal, pipe } from "@effect-ts/core/Function";
import { render } from "ink";
import * as React from "react";
import { makeMatchers } from "ts-adt/MakeADT";
import { PackageJson } from "../core/PackageJson";
import { mkPackagesState } from "../core/packagesState";
import { initialize } from "../core/intialize";
import { PackageList } from "./PackageList";
import { hideBin } from 'yargs/helpers'
import { ADT } from "ts-adt";
import { BuildCommand } from "../commands/build";
import { TreeCommand } from "../commands/tree";
import { StartCommand } from "../commands/start";
import yargs from "yargs";

const [matchTag, matchTagP] = makeMatchers("_tag");


pipe(
  initialize,
  T.chain(context => {

    const yargParsedArgs = yargs(hideBin(process.argv))
      .command('help', 'view this help message').argv

    return pipe(
      TreeCommand.parseArgs(yargParsedArgs, yargParsedArgs._),
      T.chain(TreeCommand.executeCommand(context)),
      T.orElse(() => 
        pipe(
          StartCommand.parseArgs(yargParsedArgs, yargParsedArgs._),
          T.chain(StartCommand.executeCommand(context)),
        )
      ),
      T.orElse(() => 
        pipe(
          BuildCommand.parseArgs(yargParsedArgs, yargParsedArgs._),
          T.chain(BuildCommand.executeCommand(context)),
        )
      )
    )
  })
)

pipe(
  initialize,
  T.bind("appPackageJson", (a) =>
    pipe(
      a.workspaces,
      A.findFirst((w) => w.package.name === a.app),
      fromOption,
      T.mapError(() => ({
        _tag: literal("InitialAppNotFound"),
        appName: a.app,
      }))
    )
  ),
  T.bind("reactApp", ({ workspaces, rootApp }) => {
    return renderApp(
      workspaces,
      mkPackagesState(workspaces, rootApp),
      rootApp.package
    );
  }),
  (e) =>
    T.run(
      e,
      matchTag({
        Failure: (err) => [
          pipe(
            err.cause,
            matchTagP(
              {
                Fail: (f) =>
                  pipe(
                    f.value,
                    matchTagP(
                      {
                        CircularDepFound: (c) => {
                          console.error("Circular dep found:");
                          console.error(printCircular(c.context));
                        },
                        ParseArgsError: (pae) => {
                          console.log('Error parsing argument:', pae.arg)
                          console.log(pae.args)
                        }
                      },
                      (otherwise) => {
                        console.log('ERROR', otherwise)
                      }
                    )
                  ),
              },
              () => {}
            )
          ),
        ],
        Success: () => {},
      })
    )
);

const printCircular = (deps: readonly PackageJson[]): string => {
  const depsWithoutRecursive = pipe(deps, A.takeLeft(deps.length - 1));
  return pipe(
    deps,
    A.reverse,
    NEA.fromArray,
    O.map(NEA.head),
    O.map((h) => ({ recursiveDep: h })),
    O.bind("rIndex", ({ recursiveDep }) =>
      pipe(
        depsWithoutRecursive,
        A.findIndex((d) => d.name === recursiveDep.name)
      )
    ),
    O.map(({ recursiveDep, rIndex }) => {
      const [before, after] = pipe(deps, A.splitAt(rIndex));

      const afterWithoutRecursive = pipe(after, A.takeLeft(after.length - 1));

      const beforeStrs = before.map((p) => `   ${p.name}`).join("\n    │\n");

      const afterStrs = afterWithoutRecursive
        .map(
          (p, i) =>
            `${
              i === 0
                ? "╭─ "
                : i === afterWithoutRecursive.length - 1
                ? "╰─ "
                : "│  "
            }${p.name}`
        )
        .join("\n│   │\n");

      return beforeStrs + "\n    │\n" + afterStrs;
    }),
    O.getOrElse(() => "")
  );
};
