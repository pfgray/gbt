import { AppState, AppWithProcess, PackagesState } from "./PackagesState";
import { Fiber, Option, ReadonlyArray, pipe } from "effect";
import { AppWithDeps } from "../AppWithDeps";

type Option<A> = Option.Option<A>;
type Fiber<A, B> = Fiber.Fiber<A, B>;

export type PackagesStateModifier = (s: PackagesState) => PackagesState;

export const setKilled =
  (killed: boolean): PackagesStateModifier =>
  (state) => ({
    ...state,
    killed,
  });

export const modifyApp =
  (name: string) =>
  (f: (a: AppWithProcess) => AppWithProcess): PackagesStateModifier =>
  (state) => ({
    ...state,
    workspaces: pipe(
      state.workspaces,
      ReadonlyArray.map((app) => (app.app.package.name === name ? f(app) : app))
    ),
  });

export const setAppBuildProcess =
  (name: string) =>
  (build: Option<Fiber<unknown, unknown>>): PackagesStateModifier =>
    modifyApp(name)((app) => ({ ...app, build }));

export const setAppWatchProcess =
  (name: string) =>
  (watch: Option<Fiber<unknown, unknown>>): PackagesStateModifier =>
    modifyApp(name)((app) => ({ ...app, watch }));

export const setAppState =
  (name: string) =>
  (state: AppState): PackagesStateModifier =>
    modifyApp(name)((app) => ({ ...app, state }));
