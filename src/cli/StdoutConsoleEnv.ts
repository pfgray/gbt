import { ConsoleEnv } from "../core/ConsoleEnv";
import { range } from "@effect-ts/core/Array";

import * as gradient from "gradient-string";

export const Colors = {
  Reset: "\x1b[0m",
  Bright: "\x1b[1m",
  Dim: "\x1b[2m",
  Underscore: "\x1b[4m",
  Blink: "\x1b[5m",
  Reverse: "\x1b[7m",
  Hidden: "\x1b[8m",

  FgBlack: "\x1b[30m",
  FgRed: "\x1b[31m",
  FgGreen: "\x1b[32m",
  FgYellow: "\x1b[33m",
  FgBlue: "\x1b[34m",
  FgMagenta: "\x1b[35m",
  FgCyan: "\x1b[36m",
  FgWhite: "\x1b[37m",

  BgBlack: "\x1b[40m",
  BgRed: "\x1b[41m",
  BgGreen: "\x1b[42m",
  BgYellow: "\x1b[43m",
  BgBlue: "\x1b[44m",
  BgMagenta: "\x1b[45m",
  BgCyan: "\x1b[46m",
  BgWhite: "\x1b[47m",
};

const hash = function (str: string) {
  var hash = 0,
    i,
    chr,
    len;
  if (str.length == 0) return hash;
  for (i = 0, len = str.length; i < len; i++) {
    chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};

export const toGradient = (str: string) => {
  var number = Math.abs(hash(str));
  return gradients[Math.floor(number % gradients.length)];
};

export const gradientForStr = (s: string) => {
  return gradient[toGradient(s)];
}

const gradients = [
  "fruit",
  "atlas",
  "vice",
  "morning",
  "instagram",
  "mind",
  "teen",
  "retro",
  "summer",
] as const;

const spaces = (n: number) =>
  range(0, n)
    .map(() => " ")
    .join("");

const formatForContext = (c: string, m: string) =>
  m
    .trim()
    .split("\n")
    .map((s) => s.trim())
    .map((s, i) => {
      // console.log("formattin, ", s, i);
      return i === 0 ? s : spaces(c.length) + s;
    })
    .join("\n");

export const StdoutConsoleEnv: ConsoleEnv = {
  console: {
    log: (c) => (m) => {
      console.log(gradient[toGradient(c)](c), formatForContext(c, m));
    },
    error: (c) => (m) => {
      console.error(
        gradient[toGradient(c)](c),
        Colors.FgRed + formatForContext(c, m) + Colors.Reset
      );
    },
  },
};