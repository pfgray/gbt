import { Context, Effect, Layer } from "effect";

export interface Reporter {
  log: (context?: string) => (msg: string) => Effect.Effect<never, never, void>;
  error: (
    context?: string
  ) => (msg: string) => Effect.Effect<never, never, void>;
}

// Create a tag for the MeasuringCup service
export const ReporterService = Context.Tag<Reporter>();

export const Reporter = {
  log: (context?: string) => (msg: string) =>
    ReporterService.pipe(Effect.flatMap((r) => r.log(context)(msg))),
  error: (context?: string) => (msg: string) =>
    ReporterService.pipe(Effect.flatMap((r) => r.error(context)(msg))),
};
