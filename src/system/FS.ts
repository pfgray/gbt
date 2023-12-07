import * as T from "effect/Effect";
import * as O from "effect/Option";
import { pipe } from "effect/Function";
import * as fs from "fs";
import glob from "glob";
import { makeMatchers } from "ts-adt/MakeADT";

const [matchTag] = makeMatchers("_tag");

const pathNotFound = (path: string) => ({
  _tag: `PathNotFound` as const,
  path,
});

const readFile = (path: string) =>
  T.async<
    unknown,
    { _tag: "ReadError" | "PathNotFound"; path: string },
    string
  >((cb) =>
    fs.readFile(path, { encoding: "utf-8" }, (err, s) => {
      if (err && err.code === "ENOENT") {
        cb(T.fail(pathNotFound(path)));
      } else if (err) {
        cb(T.fail({ _tag: "ReadError" as const, path }));
      } else {
        cb(T.succeed(s));
      }
    })
  );

export const FS = {
  readFile,
  glob: (path: string) =>
    T.async<unknown, { _tag: "GlobError"; path: string }, string[]>(
      (cb) => {
        glob(path, {}, (err, matches) => {
          err
            ? cb(T.fail({ _tag: "GlobError" as const, path }))
            : cb(T.succeed(matches));
        })
      }),
  readDir: (dir: string) =>
    T.async<unknown, NodeJS.ErrnoException, string[]>((cb) =>
      fs.readdir(dir, "utf-8", (err, s) => {
        err ? cb(T.fail(err)) : cb(T.succeed(s));
      })
    ),
  lstatOp: (path: string) =>
    T.async<
      unknown,
      { _tag: "LStatError"; path: string },
      O.Option<fs.Stats>
    >((cb) => {
      fs.lstat(path, (err, s) => {
        if (err && err.code === "ENOENT") {
          cb(T.succeed(O.none()));
        } else if (err) {
          cb(T.fail({ _tag: "LStatError", path }));
        } else {
          cb(T.succeed(O.some(s)));
        }
      });
    }),
  lstat: (path: string) =>
    pipe(
      FS.lstatOp(path),
      T.flatMap(
        matchTag({
          None: () => T.fail({ _tag: "LStatError", path }),
          Some: ({ value }) => T.succeed(value),
        })
      )
    ),
  mkdir: (dir: string) => {
    return pipe(
      FS.lstatOp(dir),
      T.flatMap(
        matchTag({
          None: () =>
            T.async<unknown, { _tag: "MkdirError"; path: string }, {}>(
              (cb) => {
                fs.mkdir(dir, (err) => {
                  err
                    ? cb(T.fail({ _tag: "MkdirError" as const, path: dir }))
                    : cb(T.succeed({}));
                });
              }
            ),
          Some: (stat) =>
            stat.value.isDirectory()
              ? T.succeed({})
              : T.fail({ _tag: "MkdirError" as const, path: dir }),
        })
      )
    );
  },
  writeFile: (name: string, content: string) =>
    pipe(
      T.async<unknown, { _tag: "WriteFileError"; path: string }, {}>(
        (cb) => {
          fs.writeFile(name, content, (err) => {
            err
              ? cb(T.fail({ _tag: "WriteFileError" as const, path: name }))
              : cb(T.succeed({}));
          });
        }
      )
    ),
};
