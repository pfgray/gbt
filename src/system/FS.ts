import * as T from "@effect-ts/core/Effect";
import { literal, pipe } from "@effect-ts/core/Function";
import * as fs from "fs";
import glob from "glob";

const pathNotFound = (path: string) => ({
  _tag: literal(`PathNotFound`),
  path,
});

const readFile = (path: string) =>
  pipe(
    T.fromNodeCb<NodeJS.ErrnoException, string>((cb) =>
      fs.readFile(path, { encoding: "utf-8" }, cb)
    )(),
    T.mapError(() => pathNotFound(path))
  );

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
  lstat: (path: string) =>
    T.effectAsync<unknown, NodeJS.ErrnoException, fs.Stats>((cb) => {
      fs.lstat(path, (err, s) => {
        err ? cb(T.fail(err)) : cb(T.succeed(s));
      });
    }),
};
