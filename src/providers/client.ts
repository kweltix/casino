import { z } from "zod";
import { ProviderError, type ProviderEnv, type Fetcher } from "./contracts";
import type { UsageRecord } from "../domain/types";
export async function requestOpenAI(
  env: ProviderEnv,
  path: "responses" | "images/generations",
  body: unknown,
  timeout: number,
  fetcher: Fetcher = fetch,
): Promise<unknown> {
  if (!env.AI_PROVIDER_API_KEY)
    throw new ProviderError(
      "Нужен ключ AI_PROVIDER_API_KEY в защищённых настройках среды",
      true,
    );
  try {
    const response = await fetcher("https://api.openai.com/v1/" + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + env.AI_PROVIDER_API_KEY,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
      redirect: "error",
    });
    if (!response.ok) {
      await response.body?.cancel();
      if ([401, 403].includes(response.status))
        throw new ProviderError(
          "Ключ или доступ к модели не подтверждены. Проверьте подключение OpenAI",
          true,
        );
      if (response.status === 429)
        throw new ProviderError(
          "Лимит или баланс OpenAI исчерпан. Проверьте аккаунт",
          true,
        );
      throw new ProviderError(
        "Сервис OpenAI вернул ошибку " + response.status,
        false,
        response.status >= 500,
      );
    }
    const max = path === "responses" ? 2_000_000 : 25_000_000;
    const reader = response.body?.getReader();
    if (!reader) throw new ProviderError("Пустой ответ провайдера");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel();
        throw new ProviderError("Ответ провайдера превышает допустимый размер");
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    throw new ProviderError(
      "Не удалось получить ответ OpenAI: проверьте сеть и доступ сервиса",
      false,
      true,
    );
  }
}
const responseSchema = z
  .object({
    status: z.literal("completed"),
    output: z.array(
      z
        .object({
          type: z.string(),
          content: z
            .array(
              z
                .object({
                  type: z.string(),
                  text: z.string().optional(),
                  annotations: z
                    .array(
                      z
                        .object({
                          type: z.string(),
                          url: z.string().optional(),
                        })
                        .passthrough(),
                    )
                    .optional(),
                })
                .passthrough(),
            )
            .optional(),
          action: z
            .object({
              sources: z
                .array(z.object({ url: z.string() }).passthrough())
                .optional(),
            })
            .passthrough()
            .optional(),
        })
        .passthrough(),
    ),
    usage: z
      .object({
        input_tokens: z.number().optional(),
        output_tokens: z.number().optional(),
      })
      .optional(),
  })
  .passthrough();
export function extractText(raw: unknown): string {
  const parsed = responseSchema.safeParse(raw);
  if (!parsed.success)
    throw new ProviderError("Неполный или неподдерживаемый ответ модели");
  const text = parsed.data.output
    .flatMap((x) => x.content || [])
    .filter((x) => x.type === "output_text")
    .map((x) => x.text || "")
    .join("");
  if (!text) throw new ProviderError("Модель не вернула результат");
  return text;
}
export function citedUrls(raw: unknown): Set<string> {
  const data = responseSchema.parse(raw);
  const urls = new Set<string>();
  for (const o of data.output) {
    for (const s of o.action?.sources || []) urls.add(s.url);
    for (const c of o.content || [])
      for (const a of c.annotations || [])
        if (a.type === "url_citation" && a.url) urls.add(a.url);
  }
  return urls;
}
export function jsonResult(raw: unknown): unknown {
  try {
    return JSON.parse(extractText(raw));
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    throw new ProviderError("Модель вернула некорректный JSON");
  }
}
export function usageFor(raw: unknown, operation: string): UsageRecord[] {
  const p = responseSchema.safeParse(raw);
  const u = p.success ? p.data.usage : undefined;
  return [
    {
      provider: "OpenAI",
      operation,
      units: u ? (u.input_tokens || 0) + (u.output_tokens || 0) : null,
      cost: null,
      currency: "USD",
      costStatus: "unknown",
    },
  ];
}
export function outputFormat(schema: z.ZodType, name: string) {
  const { $schema: _, ...json } = z.toJSONSchema(schema);
  return { format: { type: "json_schema", name, strict: true, schema: json } };
}
