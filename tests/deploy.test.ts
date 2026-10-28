import { it, expect } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runProcesses } from "../scripts/process-manager.mjs";
it("stops the sibling when either service exits unexpectedly", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agent-supervisor-"));
  const marker = join(dir, "terminated");
  try {
    const code = await runProcesses(
      [
        {
          file: process.execPath,
          args: [
            "-e",
            "process.on('SIGTERM',()=>{require('fs').writeFileSync(process.argv[1],'stopped');process.exit(0)});setInterval(()=>{},100)",
            marker,
          ],
        },
        {
          file: process.execPath,
          args: ["-e", "setTimeout(()=>process.exit(7),400)"],
        },
      ],
      { signal: new AbortController().signal },
    );
    expect(code).toBe(7);
    expect(readFileSync(marker, "utf8")).toBe("stopped");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
it("shuts down both processes on a supervisor stop", async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 200);
  try {
    expect(
      await runProcesses(
        [
          { file: process.execPath, args: ["-e", "setInterval(()=>{},100)"] },
          { file: process.execPath, args: ["-e", "setInterval(()=>{},100)"] },
        ],
        { signal: controller.signal },
      ),
    ).toBe(0);
  } finally {
    clearTimeout(timer);
  }
});
import { spawnSync } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
it("generates a password when copied environment template has an empty placeholder", () => {
  const dir = mkdtempSync(join(tmpdir(), "agent-setup-"));
  try {
    writeFileSync(
      join(dir, ".env.local"),
      "AI_TEXT_MODEL=gpt-5-mini\nAPP_PASSWORD=\n",
    );
    const env = { ...process.env };
    delete env.APP_PASSWORD;
    const out = spawnSync(
      process.execPath,
      [resolve("scripts/configure-auth.mjs")],
      { cwd: dir, env, encoding: "utf8" },
    );
    expect(out.status).toBe(0);
    const text = readFileSync(join(dir, ".env.local"), "utf8");
    expect(/^APP_PASSWORD=[A-Za-z0-9_-]{32}$/m.test(text)).toBe(true);
    expect(text.includes("AI_TEXT_MODEL=gpt-5-mini")).toBe(true);
    expect(existsSync(join(dir, "data/admin-access.txt"))).toBe(true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
it("preserves an existing valid password and refuses invalid short credentials", () => {
  const dir = mkdtempSync(join(tmpdir(), "agent-setup-"));
  try {
    const env = { ...process.env };
    delete env.APP_PASSWORD;
    writeFileSync(
      join(dir, ".env.local"),
      "APP_PASSWORD=already-set-test-password\n",
    );
    let out = spawnSync(
      process.execPath,
      [resolve("scripts/configure-auth.mjs")],
      { cwd: dir, env, encoding: "utf8" },
    );
    expect(out.status).toBe(0);
    expect(existsSync(join(dir, "data/admin-access.txt"))).toBe(false);
    writeFileSync(join(dir, ".env.local"), "APP_PASSWORD=short\n");
    out = spawnSync(process.execPath, [resolve("scripts/configure-auth.mjs")], {
      cwd: dir,
      env,
      encoding: "utf8",
    });
    expect(out.status).not.toBe(0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
