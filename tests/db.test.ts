import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStore } from "../src/server/db";
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const input = {
  name: "Мастер",
  address: "Екатеринбург, Ленина, 1",
  sources: [
    {
      id: "s1",
      url: "https://example.org/company",
      fetchedAt: "2026-10-28T00:00:00Z",
      excerpt: "Ремонт автомобилей",
    },
  ],
};
describe("persistent companies", () => {
  it("deduplicates a source identity without merging same-name branches", () => {
    const s = createStore(":memory:");
    const first = s.upsertCompany({ ...input, sourceId: "ya:1" });
    expect(s.upsertCompany({ ...input, sourceId: "ya:1" }).id).toBe(first.id);
    s.upsertCompany({
      ...input,
      address: "Екатеринбург, Малышева, 20",
      sourceId: "ya:2",
    });
    expect(s.listCompanies()).toHaveLength(2);
    s.close();
  });
  it("preserves reviewed drafts when a source is rediscovered", () => {
    const s = createStore(":memory:");
    const c = s.upsertCompany(input);
    s.updateCompany(
      c.id,
      { draftMessage: "Мой текст", contactStatus: "reviewed" },
      c.version,
    );
    expect(s.upsertCompany(input).draftMessage).toBe("Мой текст");
    s.close();
  });
  it.each([0, 21])("rejects a run limit of %i", (limit) => {
    const s = createStore(":memory:");
    expect(() =>
      s.createRun({ city: "Екатеринбург", niche: "автосервисы", limit }),
    ).toThrow();
    s.close();
  });
  it("restores data after reopening and rejects stale edits", () => {
    const dir = mkdtempSync(join(tmpdir(), "agent-db-"));
    dirs.push(dir);
    const path = join(dir, "test.sqlite");
    const a = createStore(path);
    const c = a.upsertCompany(input);
    const run = a.createRun({
      city: "Екатеринбург",
      niche: "автосервисы",
      limit: 20,
    });
    a.close();
    const b = createStore(path);
    expect(b.getRun(run.id)?.limit).toBe(20);
    expect(b.listCompanies()[0].id).toBe(c.id);
    b.updateCompany(c.id, { draftMessage: "новый" }, c.version);
    expect(() =>
      b.updateCompany(c.id, { draftMessage: "старый" }, c.version),
    ).toThrow("VERSION_CONFLICT");
    b.close();
  });
  it("rejects non-web sources and empty business identities", () => {
    const s = createStore(":memory:");
    expect(() => s.upsertCompany({ ...input, name: " " })).toThrow();
    expect(() =>
      s.upsertCompany({
        ...input,
        sources: [{ ...input.sources[0], url: "javascript:alert(1)" }],
      }),
    ).toThrow();
    s.close();
  });
});
