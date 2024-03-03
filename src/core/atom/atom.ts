import { Effect, ReadonlyArray, pipe } from "effect";

type Atom<A> = {
  subscribe: (cb: (a: A) => void) => () => void;
  unsubscribe: (cb: (a: A) => void) => void;
  modify: (...f: Array<(a: A) => A>) => Effect.Effect<void, never, never>;
  tapModify: <Z>(
    f: (z: Z) => (a: A) => A
  ) => <R, E>(eff: Effect.Effect<Z, E, R>) => Effect.Effect<Z, E, R>;
  tapModifyL: <Z>(
    f: (z: Z) => ReadonlyArray<(a: A) => A>
  ) => <R, E>(eff: Effect.Effect<Z, E, R>) => Effect.Effect<Z, E, R>;
  modifyNow: (...f: Array<(a: A) => A>) => void;
  get: () => A;
};

export const mkAtom = <A>(initialState: A): Atom<A> => {
  const subscriptions: Array<(a: A) => void> = [];

  let state = initialState;

  const subscribe: Atom<A>["subscribe"] = (cb) => {
    subscriptions.push(cb);
    return () => unsubscribe(cb);
  };
  const unsubscribe: Atom<A>["unsubscribe"] = (cb) => {
    const index = subscriptions.indexOf(cb);
    if (index > -1) {
      subscriptions.splice(index, 1);
    }
  };
  const tapModify: Atom<A>["tapModify"] = (f) => {
    return Effect.tap((z) =>
      Effect.sync(() => {
        modifyNow(f(z));
        subscriptions.forEach((cb) => cb(state));
      })
    );
  };
  const tapModifyL: Atom<A>["tapModifyL"] = (f) => {
    return Effect.tap((z) =>
      Effect.sync(() => {
        modifyNow(...f(z));
        subscriptions.forEach((cb) => cb(state));
      })
    );
  };
  const modify: Atom<A>["modify"] = (...fs) => {
    return Effect.sync(() => {
      modifyNow(...fs);
      subscriptions.forEach((cb) => cb(state));
    });
  };
  const modifyNow: Atom<A>["modifyNow"] = (...fs) => {
    state = pipe(
      fs,
      ReadonlyArray.reduce(state, (prev, f) => f(prev))
    );
    subscriptions.forEach((cb) => cb(state));
  };
  const get: Atom<A>["get"] = () => state;

  return {
    subscribe,
    unsubscribe,
    modify,
    modifyNow,
    get,
    tapModify,
    tapModifyL,
  };
};
