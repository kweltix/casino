import { mkdirSync, chownSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { runProcesses } from "./process-manager.mjs";
if (
  !process.env.APP_PASSWORD ||
  process.env.APP_PASSWORD.length < 16 ||
  process.env.APP_PASSWORD.length > 1024
) {
  console.error(
    "Задайте APP_PASSWORD: от 16 до 1024 символов. Сервис не запущен.",
  );
  process.exit(1);
}
if (process.env.DROP_PRIVILEGES === "1" && process.getuid?.() === 0) {
  const data = dirname(
    resolve(process.env.DATABASE_PATH || "data/agent.sqlite"),
  );
  mkdirSync(data, { recursive: true });
  chownSync(data, 1000, 1000);
  process.setgid(1000);
  process.setuid(1000);
}
const port = process.env.PORT || "3000";
if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535)
  throw new Error("Invalid PORT");
const host = process.env.HOSTNAME_BIND || "127.0.0.1";
const controller = new AbortController();
process.once("SIGINT", () => controller.abort());
process.once("SIGTERM", () => controller.abort());
process.exitCode = await runProcesses(
  [
    {
      file: process.execPath,
      args: [
        "--use-env-proxy",
        "node_modules/next/dist/bin/next",
        "start",
        "--hostname",
        host,
        "--port",
        port,
      ],
    },
    {
      file: process.execPath,
      args: ["--use-env-proxy", "--import", "tsx", "src/worker.ts"],
    },
  ],
  { signal: controller.signal },
);
