import * as T from "@effect-ts/core/Effect";
import * as O from '@effect-ts/core/Option';
import { literal, pipe } from "@effect-ts/core/Function";
import * as fs from "fs";
import glob from "glob";
import { makeMatchers } from "ts-adt/MakeADT";

const [matchTag] = makeMatchers('_tag')

const pathNotFound = (path: string) => ({
  _tag: literal(`PathNotFound`),
  path,
});

const readFile = (path: string) =>
  T.effectAsync<unknown, { _tag: "ReadError"; path: string }, string>(cb =>
    fs.readFile(path, {encoding: 'utf-8'}, (err, s) => {
      err
      ? cb(T.fail({ _tag: literal("ReadError"), path }))
      : cb(T.succeed(s));
    })
  )

export const FS = {
  readFile,
  glob: (path: string) =>
    T.effectAsync<unknown, { _tag: "GlobError"; path: string }, string[]>(
      (cb) =>
        glob(path, {}, (err, matches) => {
          err
            ? cb(T.fail({ _tag: literal("GlobError"), path }))
            : cb(T.succeed(matches));
        })
    ),
  readDir: (dir: string) =>
    T.effectAsync<unknown, NodeJS.ErrnoException, string[]>((cb) =>
      fs.readdir(dir, "utf-8", (err, s) => {
        err ? cb(T.fail(err)) : cb(T.succeed(s));
      })
    ),
  lstatOp: (path: string) =>
    T.effectAsync<unknown, { _tag: "LStatError"; path: string }, O.Option<fs.Stats>>((cb) => {
      fs.lstat(path, (err, s) => {
        if(err && err.code === 'ENOENT') {
          cb(T.succeed(O.none)) 
        } else if(err) {
          cb(T.fail({ _tag: "LStatError", path }))
        } else {
          cb(T.succeed(O.some(s)))
        }
      });
    }),
  lstat: (path: string) =>
    pipe(
      FS.lstatOp(path),
      T.chain(matchTag({
        None: () => T.fail({ _tag: "LStatError", path }),
        Some: ({value}) => T.succeed(value)
      }))
    ),
  mkdir: (dir: string) => {
    return pipe(
      FS.lstatOp(dir),
      T.chain(matchTag({
        None: () => T.effectAsync<unknown, { _tag: "MkdirError"; path: string }, {}>(
          (cb) => {
            fs.mkdir(dir, (err) => {
              err
                ? cb(T.fail({ _tag: literal("MkdirError"), path: dir }))
                : cb(T.succeed({}));
            })
          }
        ),
        Some: stat => stat.value.isDirectory() ? T.succeed({}) : T.fail({ _tag: literal("MkdirError"), path: dir })
      })
    ))
  },
  writeFile: (name: string, content: string) => 
    pipe(
      T.effectAsync<unknown, { _tag: "WriteFileError"; path: string }, {}>(cb => {
        fs.writeFile(name, content, err => {
          err
            ? cb(T.fail({ _tag: literal("WriteFileError"), path: name }))
            : cb(T.succeed({}));
        })
      }
    ))
  
};
