
import * as T from "@effect-ts/core/Effect";
import { pipe } from "@effect-ts/core/Function";

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
      T.chain(({ console }) =>
        T.effectTotal(() => {
          console.log(context)(msg);
        })
      )
    ),
  error: (context: string) => (msg: string) =>
    pipe(
      T.environment<ConsoleEnv>(),
      T.chain(({ console }) =>
        T.effectTotal(() => {
          console.error(context)(msg);
        })
      )
    ),
};
