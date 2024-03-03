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

interface FileNotFound {
  _tag: "FileNotFound";
  path: string;
}

const fileNotFound = (path: string): FileNotFound => ({
  _tag: "FileNotFound",
  path,
});

interface NotDirectory {
  _tag: "NotDirectory";
  path: string;
}
const notDirectory = (path: string): NotDirectory => ({
  _tag: "NotDirectory",
  path,
});

interface ReadError {
  _tag: "ReadError";
  path: string;
}
const readError = (path: string): ReadError => ({
  _tag: "ReadError",
  path,
});

const readFile = (path: string) =>
  T.async<string, { _tag: "ReadError" | "PathNotFound"; path: string }, never>(
    (cb) =>
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
    T.async<string[], { _tag: "GlobError"; path: string }, never>((cb) => {
      glob(path, {}, (err, matches) => {
        err
          ? cb(T.fail({ _tag: "GlobError" as const, path }))
          : cb(T.succeed(matches));
      });
    }),
  readDir: (dir: string) =>
    T.async<string[], FileNotFound | NotDirectory | ReadError, never>((cb) =>
      fs.readdir(dir, "utf-8", (err, s) => {
        if (err && err.code === "ENOENT") {
          cb(T.fail(fileNotFound(dir)));
        } else if (err && err.code === "ENOTDIR") {
          cb(T.fail(notDirectory(dir)));
        } else if (err) {
          cb(T.fail(readError(dir)));
        } else {
          cb(T.succeed(s));
        }
      })
    ),
  lstatOp: (path: string) =>
    T.async<O.Option<fs.Stats>, { _tag: "LStatError"; path: string }, never>(
      (cb) => {
        fs.lstat(path, (err, s) => {
          if (err && err.code === "ENOENT") {
            cb(T.succeed(O.none()));
          } else if (err) {
            cb(T.fail({ _tag: "LStatError", path }));
          } else {
            cb(T.succeed(O.some(s)));
          }
        });
      }
    ),
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
            T.async<{}, { _tag: "MkdirError"; path: string }, never>((cb) => {
              fs.mkdir(dir, (err) => {
                err
                  ? cb(T.fail({ _tag: "MkdirError" as const, path: dir }))
                  : cb(T.succeed({}));
              });
            }),
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
      T.async<{}, { _tag: "WriteFileError"; path: string }, never>((cb) => {
        fs.writeFile(name, content, (err) => {
          err
            ? cb(T.fail({ _tag: "WriteFileError" as const, path: name }))
            : cb(T.succeed({}));
        });
      })
    ),
};
