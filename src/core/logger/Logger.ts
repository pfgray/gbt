import { Context, Effect } from "effect";

export interface Logger {
  debug: (...msg: unknown[]) => void;
  info: (...msg: unknown[]) => void;
  warn: (...msg: unknown[]) => void;
  error: (...msg: unknown[]) => void;
}

// Create a tag for the MeasuringCup service
export class LoggerService extends Context.Tag("LoggerService")<
  LoggerService,
  Logger
>() {}

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
