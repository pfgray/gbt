import * as fs from "fs";
import { LoggerService } from "./Logger";
import { Effect, Layer } from "effect";

const handleLog =
  (prefix: string, path: fs.PathLike) =>
  (...msg: unknown[]) => {
    const now = new Date().toDateString();
    fs.writeFileSync(
      path,
      `${prefix} ${now} ` +
        msg
          .map((u) => {
            if (typeof u === "string") {
              return u;
            } else {
              return JSON.stringify(u);
            }
          })
          .join(" ")
    );
  };

export const mkFileLogEnv = (path: fs.PathLike) =>
  Layer.succeed(
    LoggerService,
    LoggerService.of({
      debug: handleLog("[DEBUG]", path),
      info: handleLog("[INFO]", path),
      error: handleLog("[ERROR]", path),
      warn: handleLog("[WARN]", path),
    })
  );
