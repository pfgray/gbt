import { Effect, Layer } from "effect";
import { ReporterService } from "./Reporter";
import { range } from "effect/ReadonlyArray";
import { gradientForStr } from "./gradients";
import { message } from "@effect/schema/Schema";

const spaces = (n: number) =>
  range(0, n)
    .map(() => " ")
    .join("");

const formatForContext = (context: string, msg: string) =>
  msg
    .trim()
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s !== "")
    .map((s, i) => {
      return i === 0 ? s : spaces(context.length) + s;
    })
    .join("\n");

export const StdoutReporter = Layer.succeed(
  ReporterService,
  ReporterService.of({
    error: (context?: string) => (msg) =>
      Effect.sync(() => {
        const messages = msg.split("\n");
        if (typeof context !== "undefined") {
          messages.forEach((msg) => {
            console.error(
              `${gradientForStr(context)} ${formatForContext(context, msg)}`
            );
          });
        } else {
          console.error(msg);
        }
      }),
    log: (context?: string) => (msg) =>
      Effect.sync(() => {
        const messages = msg.split("\n");
        if (typeof context !== "undefined") {
          messages.forEach((msg) => {
            console.log(
              `${gradientForStr(context)} ${formatForContext(context, msg)}`
            );
          });
        } else {
          console.log(msg);
        }
      }),
  })
);
