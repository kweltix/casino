import { it, expect } from "vitest";
import { makeAnalysisProvider } from "../src/providers/analysis";
import { makeSearchProvider } from "../src/providers/search";
import { requestOpenAI, extractText } from "../src/providers/client";
const s = {
  id: "s1",
  url: "https://example.org/card",
  fetchedAt: "2026-10-28T00:00:00Z",
  excerpt: "Диагностика автомобилей",
};
const company = {
  id: "c",
  name: "Сервис",
  address: "Екатеринбург, Ленина, 1",
  sources: [s],
  origin: "manual" as const,
  version: 1,
  contactStatus: "new" as const,
  draftMessage: "",
  websiteStatus: "unknown" as const,
  createdAt: s.fetchedAt,
  updatedAt: s.fetchedAt,
};
const cfg = { AI_PROVIDER_API_KEY: "private-key" };
function response(value: unknown, urls: string[] = []) {
  return new Response(
    JSON.stringify({
      status: "completed",
      output: [
        {
          type: "web_search_call",
          action: {
            type: "search",
            sources: urls.map((url) => ({ type: "url", url })),
          },
        },
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: JSON.stringify(value),
              annotations: urls.map((url) => ({
                type: "url_citation",
                url,
                title: "Source",
                start_index: 0,
                end_index: 1,
              })),
            },
          ],
        },
      ],
      usage: { input_tokens: 20, output_tokens: 40 },
    }),
    { status: 200 },
  );
}
it("separates untrusted excerpts from analysis instructions and enforces evidence", async () => {
  let sent: Record<string, unknown> = {};
  const adapter = makeAnalysisProvider(cfg, async (_url, init) => {
    sent = JSON.parse(String(init?.body));
    return response({
      observations: [{ text: "Диагностика указана", sourceIds: ["s1"] }],
      uncertainties: ["Цены неизвестны"],
      competitorSourceIds: [],
      draftMessage: "Предлагаю сайт",
      suitability: "medium",
    });
  });
  const result = await adapter.analyze({
    company,
    website: { status: "unknown", explanation: "Не проверено", sources: [] },
  });
  expect(result.analysis.observations[0].sourceIds).toEqual(["s1"]);
  expect(typeof sent.instructions).toBe("string");
  expect(String(sent.instructions)).not.toContain("Диагностика автомобилей");
  expect(String(sent.input)).toContain("Диагностика автомобилей");
});
it("does not accept discovered companies with invented source URLs", async () => {
  const adapter = makeSearchProvider(cfg, async () =>
    response(
      {
        companies: [
          {
            name: "Сервис",
            address: "Екатеринбург, Ленина, 1",
            phone: null,
            website: null,
            sources: [{ url: "https://invented.invalid", excerpt: "Сервис" }],
          },
        ],
      },
      ["https://example.org/card"],
    ),
  );
  await expect(adapter.discover({ limit: 1 })).rejects.toThrow();
});
it("accepts cited discovery results and assigns stable source ids", async () => {
  const adapter = makeSearchProvider(cfg, async () =>
    response(
      {
        companies: [
          {
            name: "Сервис",
            address: "Екатеринбург, Ленина, 1",
            phone: null,
            website: null,
            sources: [
              { url: "https://example.org/card", excerpt: "Сервис на Ленина" },
            ],
          },
        ],
      },
      ["https://example.org/card"],
    ),
  );
  const out = await adapter.discover({ limit: 1 });
  expect(out.companies).toHaveLength(1);
  expect(out.companies[0].sources[0].url).toBe("https://example.org/card");
  expect(out.usage[0].cost).toBeNull();
});
it("leaves website unknown when no independent source substantiates it", async () => {
  const adapter = makeSearchProvider(cfg, async () =>
    response(
      {
        status: "found",
        website: "https://fake.invalid",
        explanation: "нашёл",
        sources: [],
      },
      [],
    ),
  );
  await expect(adapter.verifyWebsite(company)).rejects.toThrow();
});
it("never leaks provider error bodies or credentials", async () => {
  await expect(
    requestOpenAI(
      cfg,
      "responses",
      {},
      30000,
      async () => new Response("private-key", { status: 401 }),
    ),
  ).rejects.toThrow("Ключ");
  try {
    await requestOpenAI(cfg, "responses", {}, 30000, async () => {
      throw new Error("private-key");
    });
  } catch (e) {
    expect(String(e)).not.toContain("private-key");
  }
  expect(() => extractText({ status: "incomplete", output: [] })).toThrow();
});
it("does not verify an uncited website path on a cited shared hostname", async () => {
  const adapter = makeSearchProvider(cfg, async () =>
    response(
      {
        status: "found",
        website: "https://shared.example/invented",
        explanation: "якобы сайт",
        sources: [
          {
            url: "https://shared.example/competitor",
            excerpt: "Сайт другого сервиса",
          },
        ],
      },
      ["https://shared.example/competitor"],
    ),
  );
  expect((await adapter.verifyWebsite(company)).status).toBe("unknown");
});
it("does not verify a cited URL describing an unrelated company", async () => {
  const adapter = makeSearchProvider(cfg, async () =>
    response(
      {
        status: "found",
        website: "https://service.example/",
        explanation: "якобы сайт",
        sources: [
          {
            url: "https://service.example/",
            excerpt: "Другой сервис на другой улице",
          },
        ],
      },
      ["https://service.example/"],
    ),
  );
  expect((await adapter.verifyWebsite(company)).status).toBe("unknown");
});
it("does not retain an uncited website from discovery on a cited hostname", async () => {
  const adapter = makeSearchProvider(cfg, async () =>
    response(
      {
        companies: [
          {
            name: "Сервис",
            address: "Екатеринбург, Ленина, 1",
            phone: null,
            website: "https://shared.example/invented",
            sources: [
              {
                url: "https://shared.example/card",
                excerpt: "Сервис на Ленина",
              },
            ],
          },
        ],
      },
      ["https://shared.example/card"],
    ),
  );
  expect(
    (await adapter.discover({ limit: 1 })).companies[0].website,
  ).toBeUndefined();
});
it("verifies a concrete cited website with matching name and address", async () => {
  const adapter = makeSearchProvider(cfg, async () =>
    response(
      {
        status: "found",
        website: "https://service.example/contacts",
        explanation: "Название и адрес совпадают",
        sources: [
          {
            url: "https://service.example/contacts",
            excerpt:
              "Сервис. Екатеринбург, Ленина, 1. Диагностика автомобилей.",
          },
        ],
      },
      ["https://service.example/contacts"],
    ),
  );
  expect((await adapter.verifyWebsite(company)).status).toBe("found");
});
it("does not call a directory card the company own website", async () => {
  const adapter = makeSearchProvider(cfg, async () =>
    response(
      {
        status: "found",
        website: "https://2gis.ru/ekaterinburg/firm/123",
        explanation: "карточка",
        sources: [
          {
            url: "https://2gis.ru/ekaterinburg/firm/123",
            excerpt: "Сервис. Екатеринбург, Ленина, 1.",
          },
        ],
      },
      ["https://2gis.ru/ekaterinburg/firm/123"],
    ),
  );
  expect((await adapter.verifyWebsite(company)).status).toBe("unknown");
});
