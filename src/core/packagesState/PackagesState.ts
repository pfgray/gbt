import { Fiber, Option, ReadonlyArray, pipe } from "effect";
import { AppWithDeps } from "../AppWithDeps";

type Option<A> = Option.Option<A>;
type Fiber<A, B> = Fiber.Fiber<A, B>;

export type AppState =
  | "starting"
  | "started"
  | "watching"
  | "building"
  | "inactive"
  | "waiting";

export type AppWithProcess = {
  app: AppWithDeps;
  build: Option<Fiber<unknown, unknown>>;
  watch: Option<Fiber<unknown, unknown>>;
  state: AppState;
};
export type PackagesState = {
  rootApp: AppWithDeps;
  workspaces: ReadonlyArray<AppWithProcess>;
  dependencies: ReadonlyArray<AppWithDeps>;
  killed: boolean;
};
