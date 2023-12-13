import * as T from "effect/Effect";

const enterAltScreenCommand = "\x1b[?1049h";
const leaveAltScreenCommand = "\x1b[?1049l";

export const AltScreen = {
  enter: T.sync(() => {
    process.stdout.write(enterAltScreenCommand);
  }),
  exit: T.sync(() => {
    process.stdout.write(leaveAltScreenCommand);
  }),
};
