export const trace =
  (s: string, ...ns: Array<any>) =>
  <A>(a: A): A => {
    if (ns.length > 0) {
      console.log("TRACEN", ns, s);
    } else {
      console.log("TRACEN", s);
    }
    return a;
  };

export const traceN =
  (s: string, ...ns: Array<any>) =>
  <A>(a: A): A => {
    if (ns.length > 0) {
      console.log("TRACEN", ns, s, a);
    } else {
      console.log("TRACEN", s, a);
    }
    return a;
  };
