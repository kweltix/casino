import { spawn } from "node:child_process";
/** @param {{file:string,args:string[]}[]} commands @param {{signal:AbortSignal}} options */
export async function runProcesses(commands, { signal }) {
  if (signal.aborted) return 0;
  const children = commands.map((c) =>
    spawn(c.file, c.args, { stdio: "inherit", env: process.env }),
  );
  const exits = children.map(
    (child) =>
      new Promise((resolve) => {
        child.once("error", () => resolve(1));
        child.once("exit", (code) => resolve(code || 1));
      }),
  );
  let stop;
  const stopped = new Promise((resolve) => {
    stop = () => resolve(0);
    signal.addEventListener("abort", stop, { once: true });
    if (signal.aborted) stop();
  });
  let code;
  try {
    code = await Promise.race([...exits, stopped]);
  } finally {
    signal.removeEventListener("abort", stop);
    for (const child of children)
      if (child.exitCode === null && child.signalCode === null)
        child.kill("SIGTERM");
    const timer = setTimeout(() => {
      for (const child of children)
        if (child.exitCode === null && child.signalCode === null)
          child.kill("SIGKILL");
    }, 10000);
    timer.unref();
    await Promise.all(exits);
    clearTimeout(timer);
  }
  return Number(code);
}
