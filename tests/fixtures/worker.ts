import { createServer } from "node:http";
import { resolve, basename } from "node:path";
import { getStore } from "../../src/server/db";
import { runWorker } from "../../src/server/worker-loop";
import { fixtureProviders } from "./providers";
if (
  process.env.AI_AGENT_TEST_MODE !== "1" ||
  !basename(resolve(process.env.DATABASE_PATH || "")).startsWith("e2e-")
)
  throw new Error("Test worker requires isolated E2E database");
const controller = new AbortController();
const store = getStore();
const server = createServer((_req, res) => {
  res.writeHead(200);
  res.end("fixture worker ready");
});
server.listen(3101, "127.0.0.1");
process.on("SIGTERM", () => controller.abort());
process.on("SIGINT", () => controller.abort());
try {
  await runWorker(store, fixtureProviders, controller.signal);
} finally {
  server.close();
  store.close();
}
