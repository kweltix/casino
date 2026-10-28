import type { Store } from "./db";
import { Queue } from "./jobs";
import { ProviderError, type Providers } from "../providers/contracts";
import { validateAnalysis } from "../providers/analysis";
import type { Job, UsageRecord } from "../domain/types";
export async function processJob(
  job: Job,
  providers: Providers,
  store: Store,
): Promise<void> {
  const q = new Queue(store);
  if (!q.isActive(job)) return;
  async function track<T extends { usage?: UsageRecord[] }>(
    operation: string,
    call: () => Promise<T>,
  ): Promise<T> {
    const record = store.addUsage(job.runId, {
      provider: "OpenAI",
      operation,
      units: null,
      cost: null,
      currency: "USD",
      costStatus: "unknown",
    });
    const out = await call();
    if (out.usage?.[0]) store.updateUsage(record.id, out.usage[0]);
    for (const extra of out.usage?.slice(1) || [])
      store.addUsage(job.runId, extra);
    return out;
  }
  try {
    const run = store.getRun(job.runId)!;
    if (job.kind === "discover") {
      const out = await track("discovery", () =>
        providers.search.discover({
          city: run.city,
          niche: run.niche,
          limit: run.limit,
        }),
      );
      q.finishJob(job, () => {
        for (const input of out.companies.slice(0, run.limit)) {
          const c = store.upsertCompany(input);
          store.linkCompany(run.id, c.id);
          q.enqueueJob(run.id, "analyze", { companyId: c.id });
        }
      });
      return;
    }
    const company = store.getCompany(job.payload.companyId || "");
    if (!company) throw new ProviderError("Компания не найдена");
    if (job.kind === "analyze") {
      const website = await track("website_research", () =>
        providers.search.verifyWebsite(company),
      );
      if (!q.isActive(job)) return;
      const sources = [
        ...new Map(
          [...company.sources, ...website.sources].map((s) => [s.id, s]),
        ).values(),
      ];
      const enriched = { ...company, sources };
      const out = await track("analysis", () =>
        providers.analysis.analyze({ company: enriched, website }),
      );
      const analysis = validateAnalysis(out.analysis, sources);
      q.finishJob(job, () => {
        const latest = store.getCompany(company.id)!;
        const replaceDraft =
          latest.contactStatus === "new" &&
          (latest.draftMessage === "" || latest.draftSource === "generated") &&
          latest.draftMessage === company.draftMessage;
        store.changeCompany(company.id, {
          analysis,
          sources,
          websiteStatus: website.status,
          website: website.website || company.website,
          websiteExplanation: website.explanation,
          websiteCheckedAt: new Date().toISOString(),
          draftMessage: replaceDraft
            ? analysis.draftMessage
            : latest.draftMessage,
          draftSource: replaceDraft ? "generated" : latest.draftSource,
        });
      });
      return;
    }
    if (!company.analysis)
      throw new ProviderError("Сначала выполните анализ компании", true);
    const out = await track("image", () =>
      providers.images.generate({ company }),
    );
    q.finishJob(job, () => {
      store.changeCompany(company.id, { image: out.image });
    });
  } catch (e) {
    const known = e instanceof ProviderError;
    q.failJob(job, {
      message: known
        ? e.message
        : "Результат не прошёл проверку или обработка прервалась. Повторите после проверки данных",
      blocked: known && e.blocked,
      retryable: known && e.retryable,
    });
  }
}
