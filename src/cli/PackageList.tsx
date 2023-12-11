import * as React from "react";
import { PackageJson } from "../core/PackageJson";
import { Text, useInput, useApp, Box, Spacer } from "ink";
import { pipe } from "effect/Function";
import { killedL, mkPackagesState } from "../core/packagesState";
import Gradient from "ink-gradient";
import * as T from "effect/Effect";

import Divider from "ink-divider";
import { toGradient, StdoutReporter } from "./StdoutReporter";
import useStdoutDimensions from "ink-use-stdout-dimensions";

import Spinner from "ink-spinner";
import { ChokidarWatchEnv } from "../system/WatchEnv";

type PackageListProps = {
  workspaces: Array<{
    package: PackageJson;
    localDeps: Array<PackageJson>;
  }>;
  rootApp: PackageJson;
  packagesState: ReturnType<typeof mkPackagesState>;
  exit: () => void;
};

const between = (min: number, max: number) => (n: number) =>
  Math.min(max, Math.max(n, min));

export const PackageList = (props: PackageListProps) => {
  const { packagesState: appStateA, workspaces, rootApp } = props;

  const [packagesState, setPackagesState] = React.useState(
    appStateA.atom.get()
  );

  React.useEffect(() => {
    pipe(
      appStateA.startApp(rootApp),
      T.flatMap(() =>
        T.effectAsync((cb) => {
          appStateA.atom.subscribe({
            next: () => {
              if (appStateA.atom.get().killed) {
                cb(T.succeed(0));
              }
            },
          });
          return T.succeed(0);
        })
      ),
      T.provide(StdoutReporter),
      T.provide(ChokidarWatchEnv),
      T.run
    );
  }, []);

  React.useEffect(() => {
    const subscription = appStateA.atom.subscribe({
      next: (a) => setPackagesState(appStateA.atom.get()),
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [appStateA]);

  const app = useApp();

  useInput((input, key) => {
    if (input === "q") {
      app.exit();
      pipe(
        appStateA.atom.get().workspaces.map((a) => a.app.package),
        T.forEach(appStateA.killApp),
        T.run
      );
      appStateA.atom.modify(killedL.modify(() => true));
      props.exit();
    }
  });

  const [columns, rows] = useStdoutDimensions();

  return (
    <>
      <Divider width={columns} padding={0} title={rootApp.name} />
      {/* <Text color="green">{packagesState.workspaces.length}</Text> */}
      {packagesState.workspaces
        .filter((w) => w.app.package.name !== rootApp.name)
        .map((w) => (
          <Box key={w.app.package.name} width="35%">
            <Text>
              <Gradient name={toGradient(w.app.package.name)}>
                {w.app.package.name}
              </Gradient>
            </Text>
            <Spacer />
            <Text>
              {w.state === "building" ? (
                <>
                  <Spinner type="dots" />{" "}
                </>
              ) : (
                ""
              )}
              {w.state}
            </Text>
          </Box>
        ))}
    </>
  );

  // <Box flexDirection="column">
  //   {pipe(
  //     packagesState.workspaces,
  //     A.mapWithIndex((i, w) => (
  //       <Box key={w.app.package.name}>
  //         <Gradient name={toGradient(w.app.package.name)}>
  //           {w.app.package.name}:{w.app.package.version}
  //         </Gradient>
  //         <jSpacer />
  //         <Text>{w.state}</Text>
  //       </Box>
  //     ))
  //   )}
  // </Box>

  // return (
  //   <>
  //     <Gradient name="pastel">@simspace/portal-client</Gradient>
  //     <Gradient name="passion">@simspace/monorail</Gradient>
  //     <Gradient name="morning">@simspace/fp-ts-ext</Gradient>
  //     <Gradient name="teen">@simspace/redux-ext</Gradient>
  //     <Gradient name="summer">@simspace/simspace-schema</Gradient>
  //     {/* <Gradient name="cristal">asdflkjlksjfas;dlkfjasdf;lkj</Gradient>
  //     <Gradient name="teen">asdflkjlksjfas;dlkfjasdf;lkj</Gradient>
  //     <Gradient name="summer">asdflkjlksjfas;dlkfjasdf;lkj</Gradient> */}
  //   </>
  // );

  // return h(
  //   Box,
  //   {},
  //   pipe(
  //     workspaces,
  //     A.mapWithIndex((i, w) =>
  //       h(
  //         Box,
  //         { key: w.package.name },
  //         h(
  //           Box,
  //           {
  //             borderStyle: "round",
  //             borderColor: i === highlighted ? "yellow" : "green",
  //             key: "a",
  //           },
  //           h(Text, {}, `${w.package.name}:${w.package.version}`),
  //           w.localDeps.map((ld) =>
  //             h(
  //               Text,
  //               { color: "gray", key: ld.name },
  //               `${ld.name}:${ld.version}`
  //             )
  //           )
  //         ),
  //         h(Newline, { key: "b" })
  //       )
  //     )
  //   )
  // );
};
