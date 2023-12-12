import { LoggerService } from "./Logger";
import { Layer } from "effect";

const handleLog =
  (prefix: string, method: "debug" | "info" | "error" | "warn") =>
  (...msg: unknown[]) => {
    const now = new Date().toDateString();
    console[method](`${prefix} ${now} ${msg.join(" ")}`);
  };

export const mkConsoleLogger = () =>
  Layer.succeed(
    LoggerService,
    LoggerService.of({
      debug: handleLog("[DEBUG]", "debug"),
      info: handleLog("[INFO]", "info"),
      error: handleLog("[ERROR]", "error"),
      warn: handleLog("[WARN]", "warn"),
    })
  );
