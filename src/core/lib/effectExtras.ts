import * as T from "effect/Effect";

export const tapSync = <A>(
  f: (a: A) => void
): (<R, E>(eff: T.Effect<A, E, R>) => T.Effect<A, E, R>) =>
  T.tap((a) => T.sync(() => f(a)));
