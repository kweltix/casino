import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import type { Store } from "./db";
import { Queue } from "./jobs";
import { processJob } from "./pipeline";
import type { Providers } from "../providers/contracts";
export async function runWorker(
  store: Store,
  providers: Providers,
  signal: AbortSignal,
) {
  const queue = new Queue(store);
  const owner = randomUUID();
  while (!signal.aborted) {
    const job = queue.claimJob(owner);
    if (!job) {
      await delay(300);
      continue;
    }
    const heartbeat = setInterval(() => queue.renew(job), 30000);
    try {
      await processJob(job, providers, store);
    } finally {
      clearInterval(heartbeat);
    }
  }
}
