import { Context, Effect } from "effect";

export interface Reporter {
  log: (context?: string) => (msg: string) => Effect.Effect<void, never, never>;
  error: (
    context?: string
  ) => (msg: string) => Effect.Effect<void, never, never>;
}

export class ReporterService extends Context.Tag("ReporterService")<
  ReporterService,
  Reporter
>() {}

export const Reporter = {
  log: (context?: string) => (msg: string) =>
    ReporterService.pipe(Effect.flatMap((r) => r.log(context)(msg))),
  error: (context?: string) => (msg: string) =>
    ReporterService.pipe(Effect.flatMap((r) => r.error(context)(msg))),
};
