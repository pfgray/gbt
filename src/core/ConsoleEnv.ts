
import * as T from "effect/Effect";
import { pipe } from "effect/Function";

/**
 * An environment for printing things to the application view
 */
export interface ConsoleEnv {
  console: {
    log: (context: string) => (msg: string) => void;
    error: (context: string) => (msg: string) => void;
  };
}

export const ConsoleE = {
  log: (context: string) => (msg: string) =>
    pipe(
      T.environment<ConsoleEnv>(),
      T.flatMap(({ console }) =>
        T.effectTotal(() => {
          console.log(context)(msg);
        })
      )
    ),
  error: (context: string) => (msg: string) =>
    pipe(
      T.environment<ConsoleEnv>(),
      T.flatMap(({ console }) =>
        T.effectTotal(() => {
          console.error(context)(msg);
        })
      )
    ),
};
