import * as T from "@effect-ts/core/Effect";

const enterAltScreenCommand = "\x1b[?1049h";
const leaveAltScreenCommand = "\x1b[?1049l";

export const AltScreen = {
  enter: T.effectTotal(() => {
    process.stdout.write(enterAltScreenCommand);
  }),
  exit: T.effectTotal(() => {
    process.stdout.write(leaveAltScreenCommand);
  }),
};
