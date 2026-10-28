import { getStore } from "./server/db";
import { runWorker } from "./server/worker-loop";
import { getProviders } from "./providers/config";
const store = getStore();
const controller = new AbortController();
process.on("SIGTERM", () => controller.abort());
process.on("SIGINT", () => controller.abort());
console.log("AI Agent worker запущен");
try {
  await runWorker(store, getProviders(), controller.signal);
} finally {
  store.close();
  console.log("AI Agent worker остановлен");
}
