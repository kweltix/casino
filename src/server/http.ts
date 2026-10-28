import { z } from "zod";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Store } from "./db";
import { Queue } from "./jobs";
import {
  companyInputSchema,
  editSchema,
  runSchema,
} from "../domain/validation";
import { getProviderStatus } from "../providers/config";
import type { ProviderEnv } from "../providers/contracts";
import {
  SessionAuth,
  appOrigin,
  readSessionCookie,
  sessionCookie,
} from "./auth";
import { artifactDir } from "../providers/images";
const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
async function body(request: Request) {
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    throw new HttpError(415, "Нужен JSON");
  if (Number(request.headers.get("content-length")) > 65536)
    throw new HttpError(413, "Слишком большой запрос");
  const reader = request.body?.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  if (reader)
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65536) {
        await reader.cancel();
        throw new HttpError(413, "Слишком большой запрос");
      }
      chunks.push(value);
    }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Некорректный JSON");
  }
}
export function createApi(store: Store, env: ProviderEnv = process.env) {
  const q = new Queue(store);
  return async (request: Request): Promise<Response> => {
    try {
      const url = new URL(request.url);
      const path = url.pathname
        .replace(/^\/api\/?/, "")
        .split("/")
        .filter(Boolean);
      const method = request.method;
      if (!["GET", "POST", "PATCH", "DELETE"].includes(method))
        throw new HttpError(405, "Метод не поддерживается");
      const auth = new SessionAuth(store, env);
      if (method === "GET" && path.join("/") === "health")
        return json(
          { status: auth.configured ? "ok" : "unconfigured" },
          auth.configured ? 200 : 503,
        );
      const configuredOrigin = appOrigin(env);
      const transport = new URL(
        url.protocol + "//" + (request.headers.get("host") || url.host),
      );
      if (
        configuredOrigin
          ? transport.host !== new URL(configuredOrigin).host
          : !["localhost", "127.0.0.1", "[::1]"].includes(transport.hostname)
      )
        throw new HttpError(403, "Разрешён только локальный доступ");
      if (
        method !== "GET" &&
        request.headers.get("origin") !== (configuredOrigin || transport.origin)
      )
        throw new HttpError(
          403,
          "Изменения разрешены только из интерфейса приложения",
        );
      if (!auth.configured)
        return json(
          {
            error:
              "Доступ не настроен: задайте APP_PASSWORD длиной от 16 символов",
          },
          503,
        );
      const token = readSessionCookie(request.headers.get("cookie"), env);
      if (path.join("/") === "auth/login" && method === "POST") {
        const input = z
          .object({ password: z.string().min(1).max(1024) })
          .strict()
          .parse(await body(request));
        let session;
        try {
          session = await auth.login(input.password);
        } catch (e) {
          if (e instanceof Error && e.message === "RATE_LIMIT")
            return Response.json(
              { error: "Слишком много попыток. Повторите через 15 минут" },
              {
                status: 429,
                headers: { "Retry-After": "900", "Cache-Control": "no-store" },
              },
            );
          throw e;
        }
        if (!session) return json({ error: "Неверный пароль" }, 401);
        const response = json({ ok: true });
        response.headers.set("Set-Cookie", sessionCookie(session.token, env));
        return response;
      }
      if (path.join("/") === "auth/logout" && method === "POST") {
        z.object({})
          .strict()
          .parse(await body(request));
        auth.logout(token);
        const response = json({ ok: true });
        response.headers.set("Set-Cookie", sessionCookie("", env, true));
        return response;
      }
      if (!auth.isAuthenticated(token))
        return json({ error: "Войдите в приложение" }, 401);
      if (method === "GET" && path.join("/") === "workspace")
        return json({
          companies: store.listCompanies(),
          runs: store.listRuns(),
          usage: store.getUsage(),
          providers: getProviderStatus(env),
          testMode: env.AI_AGENT_TEST_MODE === "1",
        });
      if (method === "GET" && path.join("/") === "status")
        return json({
          providers: getProviderStatus(env),
          testMode: env.AI_AGENT_TEST_MODE === "1",
        });
      if (path[0] === "runs") {
        if (path.length === 1 && method === "GET")
          return json({ runs: store.listRuns(), usage: store.getUsage() });
        if (path.length === 1 && method === "POST") {
          const data = runSchema.parse(await body(request));
          const run = store.db
            .transaction(() => {
              const r = store.createRun(data);
              q.enqueueJob(r.id, "discover", {});
              return store.getRun(r.id)!;
            })
            .immediate();
          return json(run, 201);
        }
        if (path.length === 2) {
          const run = store.getRun(path[1]);
          if (!run) throw new HttpError(404, "Запуск не найден");
          if (method === "GET")
            return json({
              ...run,
              companies: store.listCompanies(run.id),
              usage: store.getUsage(run.id),
            });
          if (method === "DELETE") {
            q.cancelRun(run.id);
            return json(store.getRun(run.id));
          }
        }
      }
      if (path[0] === "companies") {
        if (path.length === 1 && method === "GET")
          return json(
            store.listCompanies(url.searchParams.get("run") || undefined),
          );
        if (path.length === 1 && method === "POST") {
          const data = companyInputSchema.parse(await body(request));
          return json(store.upsertCompany({ ...data, origin: "manual" }), 201);
        }
        if (path.length >= 2) {
          const company = store.getCompany(path[1]);
          if (!company) throw new HttpError(404, "Компания не найдена");
          if (path.length === 2 && method === "GET") return json(company);
          if (path.length === 2 && method === "PATCH") {
            const { version, ...patch } = editSchema.parse(await body(request));
            return json(store.updateCompany(company.id, patch, version));
          }
          if (
            path.length === 3 &&
            method === "POST" &&
            ["analyze", "concept"].includes(path[2])
          ) {
            z.object({})
              .strict()
              .parse(await body(request));
            const kind = path[2] === "concept" ? "image" : "analyze";
            if (kind === "image" && !company.analysis)
              throw new HttpError(409, "Сначала выполните анализ");
            const run = store.db
              .transaction(() => {
                const active = store.db
                  .prepare(
                    "SELECT runId,payload FROM jobs WHERE kind=? AND status IN ('pending','running')",
                  )
                  .all(kind) as { runId: string; payload: string }[];
                const existing = active.find(
                  (j) => JSON.parse(j.payload).companyId === company.id,
                );
                if (existing) return store.getRun(existing.runId)!;
                const r = store.createRun({ limit: 1 });
                store.linkCompany(r.id, company.id);
                q.enqueueJob(r.id, kind, { companyId: company.id });
                return store.getRun(r.id)!;
              })
              .immediate();
            return json(run, 202);
          }
          if (path.length === 3 && path[2] === "image" && method === "GET") {
            if (
              !company.image ||
              !/^[0-9a-f-]{36}\.png$/.test(company.image.fileName)
            )
              throw new HttpError(404, "Референс ещё не создан");
            let bytes: Buffer;
            try {
              bytes = await readFile(
                join(artifactDir(), company.image.fileName),
              );
            } catch {
              throw new HttpError(404, "Файл референса не найден");
            }
            return new Response(new Uint8Array(bytes), {
              headers: {
                "Content-Type": "image/png",
                "Content-Length": String(bytes.byteLength),
                "X-Content-Type-Options": "nosniff",
                "Cache-Control": "private, no-cache",
                "Content-Security-Policy": "default-src 'none'",
              },
            });
          }
        }
      }
      throw new HttpError(404, "Адрес не найден");
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      if (e instanceof z.ZodError)
        return json(
          {
            error: "Проверьте заполнение полей",
            fields: e.issues.map((i) => i.path.join(".")).slice(0, 10),
          },
          400,
        );
      if (e instanceof Error && e.message === "VERSION_CONFLICT")
        return json(
          { error: "Карточка изменилась. Обновите её перед сохранением" },
          409,
        );
      if (e instanceof Error && e.message === "NOT_FOUND")
        return json({ error: "Объект не найден" }, 404);
      return json(
        { error: "Не удалось выполнить действие. Повторите запрос" },
        500,
      );
    }
  };
}
