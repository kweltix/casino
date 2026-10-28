import { rmSync, mkdirSync } from "node:fs";
import { resolve, basename, dirname } from "node:path";
const path = resolve(process.env.DATABASE_PATH || "");
if (
  process.env.AI_AGENT_TEST_MODE !== "1" ||
  !basename(path).startsWith("e2e-") ||
  !path.startsWith(resolve("data") + "/")
)
  throw new Error("Unsafe test database");
mkdirSync(dirname(path), { recursive: true });
for (const suffix of ["", "-wal", "-shm"])
  rmSync(path + suffix, { force: true });
const artifacts = resolve(process.env.ARTIFACT_DIR || "");
if (
  basename(artifacts) === "e2e-artifacts" &&
  artifacts.startsWith(resolve("data") + "/")
)
  rmSync(artifacts, { recursive: true, force: true });
