import { afterEach, it, expect } from "vitest";
import { createStore, type Store } from "../src/server/db";
import { createApi } from "../src/server/http";
const stores: Store[] = [];
afterEach(() => {
  for (const s of stores.splice(0)) s.close();
});
const setup = () => {
  const s = createStore(":memory:");
  stores.push(s);
  return {
    s,
    api: createApi(s, { AI_PROVIDER_API_KEY: "private-test-secret" }),
  };
};
const request = (
  path: string,
  method = "GET",
  data?: unknown,
  origin = "http://localhost:3000",
) =>
  new Request("http://localhost:3000/api/" + path, {
    method,
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
const input = {
  name: "Авто Мастер",
  address: "Екатеринбург, Ленина, 5",
  sources: [
    {
      id: "manual-1",
      url: "https://example.org/card",
      fetchedAt: "2026-10-28T00:00:00Z",
      excerpt: "Диагностика автомобилей",
    },
  ],
};
it("blocks cross-origin and non-JSON mutations before side effects", async () => {
  const { s, api } = setup();
  expect(
    (await api(request("runs", "POST", { limit: 1 }, "https://hostile.test")))
      .status,
  ).toBe(403);
  expect(s.listRuns()).toHaveLength(0);
  const noJson = new Request("http://localhost:3000/api/runs", {
    method: "POST",
    headers: { Origin: "http://localhost:3000" },
    body: "{}",
  });
  expect((await api(noJson)).status).toBe(415);
});
it("enforces run limits, unknown fields, payload size and identifiers", async () => {
  const { api } = setup();
  expect((await api(request("runs", "POST", { limit: 21 }))).status).toBe(400);
  expect(
    (await api(request("companies", "POST", { ...input, execute: "x" })))
      .status,
  ).toBe(400);
  expect(
    (
      await api(
        request("companies", "POST", { ...input, name: "x".repeat(70000) }),
      )
    ).status,
  ).toBe(413);
  expect((await api(request("companies/not-there"))).status).toBe(404);
  expect((await api(request("runs/not-there", "DELETE"))).status).toBe(404);
});
it("creates durable search jobs without revealing secrets", async () => {
  const { s, api } = setup();
  const res = await api(request("runs", "POST", { limit: 2 }));
  expect(res.status).toBe(201);
  const data = await res.json();
  expect(s.getRun(data.id)?.jobs[0].kind).toBe("discover");
  const status = await (await api(request("status"))).text();
  expect(status).not.toContain("private-test-secret");
  expect(status).toContain("available");
});
it("protects concurrent draft editing and returns the persisted message", async () => {
  const { api } = setup();
  const c = await (await api(request("companies", "POST", input))).json();
  const updated = await api(
    request("companies/" + c.id, "PATCH", {
      version: 1,
      draftMessage: "Добрый день",
    }),
  );
  expect(updated.status).toBe(200);
  expect(
    (
      await api(
        request("companies/" + c.id, "PATCH", {
          version: 1,
          draftMessage: "потерянная правка",
        }),
      )
    ).status,
  ).toBe(409);
  const result = await (await api(request("companies/" + c.id))).json();
  expect(result.draftMessage).toBe("Добрый день");
});
it("requires analysis before concept and deduplicates active operations", async () => {
  const { api, s } = setup();
  const c = await (await api(request("companies", "POST", input))).json();
  expect(
    (await api(request("companies/" + c.id + "/concept", "POST", {}))).status,
  ).toBe(409);
  const a = await (
    await api(request("companies/" + c.id + "/analyze", "POST", {}))
  ).json();
  const b = await (
    await api(request("companies/" + c.id + "/analyze", "POST", {}))
  ).json();
  expect(a.id).toBe(b.id);
  expect(s.listRuns()).toHaveLength(1);
});
it("keeps manual provenance and refuses arbitrary image file paths", async () => {
  const { api } = setup();
  const c = await (
    await api(request("companies", "POST", { ...input, origin: "search" }))
  ).json();
  expect(c.origin).toBe("manual");
  const res = await api(request("companies/" + c.id + "/image"));
  expect(res.status).toBe(404);
});
it("accepts the actual local Host when Next normalizes the request URL", async () => {
  const { api } = setup();
  const req = new Request("http://localhost:3100/api/runs", {
    method: "POST",
    headers: {
      Host: "127.0.0.1:3100",
      Origin: "http://127.0.0.1:3100",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ limit: 1 }),
  });
  expect((await api(req)).status).toBe(201);
});
it("rejects hostile Host even when its Origin matches", async () => {
  const { api } = setup();
  const req = new Request("http://localhost:3100/api/runs", {
    method: "POST",
    headers: {
      Host: "hostile.test:3100",
      Origin: "http://hostile.test:3100",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  expect((await api(req)).status).toBe(403);
});
