import * as T from "effect/Effect";
import { pipe } from "effect/Function";
import * as fs from "fs";
import { match } from "ts-adt";

import { Context, Effect, Layer } from "effect";

export interface Logger {
  debug: (...msg: unknown[]) => void;
  info: (...msg: unknown[]) => void;
  warn: (...msg: unknown[]) => void;
  error: (...msg: unknown[]) => void;
}

// Create a tag for the MeasuringCup service
export const LoggerService = Context.Tag<Logger>();

export const Logger = {
  debug: (...msg: unknown[]) =>
    LoggerService.pipe(Effect.tap((r) => r.debug(...msg))),
  info: (...msg: unknown[]) =>
    LoggerService.pipe(Effect.tap((r) => r.info(...msg))),
  warn: (...msg: unknown[]) =>
    LoggerService.pipe(Effect.tap((r) => r.warn(...msg))),
  error: (...msg: unknown[]) =>
    LoggerService.pipe(Effect.tap((r) => r.error(...msg))),
};

// const handleLog =
//   (consoleMethod: 'log' | 'warn' | 'info' | 'debug', filePrefix: string, ...msg: unknown[]) =>
//   (logEnv: LogEnv) =>
//   T.sync(() => {
//     const now = new Date().toDateString()
//     pipe(
//       logEnv.mode,
//       match({
//         stdout: () => console[consoleMethod](now, ...msg),
//         file: ({path}) => {
//           fs.writeFileSync(path, `${filePrefix} ${now} ` + msg.map(u => {
//             if(typeof u === 'string') {
//               return u
//             } else {
//               return JSON.stringify(u)
//             }
//           }).join(" "))
//         }
//       })
//     )
//   })
