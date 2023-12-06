
import * as T from "@effect-ts/core/Effect";
import { pipe } from "@effect-ts/core/Function";
import * as fs from 'fs'
import { match } from "ts-adt";

type LogMode = {
  _type: 'stdout'
} | {
  _type: 'file',
  path: fs.PathLike
}

/**
 * An environment for printing things to the application view
 */
export interface LogEnv {
  logger: {
    debug: (...msg: unknown[]) => void; 
    info: (...msg: unknown[]) => void;
    warn: (...msg: unknown[]) => void
    error: (...msg: unknown[]) => void;
  };
}

// const handleLog = 
//   (consoleMethod: 'log' | 'warn' | 'info' | 'debug', filePrefix: string, ...msg: unknown[]) =>
//   (logEnv: LogEnv) =>
//   T.effectTotal(() => {
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


export const LogE = {
  info: (...msg: unknown[]) =>
    pipe(
      T.environment<LogEnv>(),
      T.chain(({ logger }) => T.effectTotal(() => {
        logger.info(...msg)
      })
    )),
  debug: (...msg: unknown[]) =>
    pipe(
      T.environment<LogEnv>(),
      T.chain(({ logger }) => T.effectTotal(() => {
        logger.debug(...msg)
      })
    )),
  warn: (...msg: unknown[]) =>
    pipe(
      T.environment<LogEnv>(),
      T.chain(({ logger }) => T.effectTotal(() => {
        logger.warn(...msg)
      })
    )),
  error: (...msg: unknown[]) =>
    pipe(
      T.environment<LogEnv>(),
      T.chain(({ logger }) => T.effectTotal(() => {
        logger.error(...msg)
      })
    )),
};