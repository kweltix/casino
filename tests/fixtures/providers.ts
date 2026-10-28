import { setTimeout as delay } from "node:timers/promises";
import { writeFile, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { Providers } from "../../src/providers/contracts";
import { artifactDir } from "../../src/providers/images";
export const fixtureProviders: Providers = {
  search: {
    async discover() {
      await delay(2000);
      return {
        companies: [
          {
            name: "Тестовый автосервис",
            address: "Екатеринбург, Тестовая, 1",
            origin: "test",
            sources: [
              {
                id: "fixture-card",
                url: "https://example.test/service",
                fetchedAt: new Date().toISOString(),
                excerpt:
                  "Тестовая карточка: ремонт подвески и диагностика. Цены не указаны.",
              },
            ],
          },
        ],
        usage: [],
      };
    },
    async verifyWebsite() {
      return {
        status: "unknown",
        explanation: "Тестовый ответ: сайт не подтверждён",
        sources: [],
        usage: [],
      };
    },
  },
  analysis: {
    async analyze({ company }) {
      return {
        analysis: {
          observations: [
            {
              text: "В карточке перечислены услуги, но не указаны ориентировочные цены.",
              sourceIds: [company.sources[0].id],
            },
          ],
          uncertainties: [
            "Это синтетический результат для проверки приложения, не анализ реального бизнеса.",
          ],
          competitorSourceIds: [],
          draftMessage:
            "Здравствуйте! Предлагаю обсудить сайт за 25–35 тысяч ₽. Можно показать концепт?",
          suitability: "medium",
        },
        usage: [],
      };
    },
  },
  images: {
    async generate() {
      await mkdir(artifactDir(), { recursive: true });
      const fileName = randomUUID() + ".png";
      await writeFile(
        join(artifactDir(), fileName),
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
          "base64",
        ),
      );
      return {
        image: {
          fileName,
          mime: "image/png",
          createdAt: new Date().toISOString(),
          prompt: "Synthetic test image",
        },
        usage: [],
      };
    },
  },
};
