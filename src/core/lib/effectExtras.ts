import * as T from "effect/Effect";

export const tapSync = <A>(
  f: (a: A) => void
): (<R, E>(eff: T.Effect<R, E, A>) => T.Effect<R, E, A>) =>
  T.tap((a) => T.sync(() => f(a)));
