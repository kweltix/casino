"use client";
import { useCallback, useEffect, useState } from "react";
import type { Company, Run, Usage, ProviderStatus } from "../domain/types";
import type { CompanyInput } from "../domain/validation";
import { CompanyList } from "./company-list";
import { CompanyDetail } from "./company-detail";
import { RunForm } from "./run-form";
import { ManualForm } from "./manual-form";
import { Icon, date, jobLabels, kindLabels } from "./ui";
type Data = {
  companies: Company[];
  runs: Run[];
  usage: Usage[];
  providers: ProviderStatus[];
  testMode: boolean;
};
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const r = await fetch("/api/" + path, {
    method,
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = await r.json();
  if (r.status === 401) {
    window.location.assign("/login");
    throw new Error("Сессия завершена. Войдите снова");
  }
  if (!r.ok) throw new Error(data.error || "Не удалось выполнить запрос");
  return data as T;
}
export function Workspace() {
  const [data, setData] = useState<Data | null>(null);
  const [view, setView] = useState<"companies" | "runs" | "settings">(
    "companies",
  );
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [loadError, setLoadError] = useState("");
  const refresh = useCallback(async () => {
    try {
      setData(await api<Data>("workspace"));
      setLoadError("");
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "Не удалось загрузить данные",
      );
    }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 2500);
    return () => clearInterval(timer);
  }, [refresh]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setManual(false);
        setSelected(null);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  const companies = data?.companies || [];
  const runs = data?.runs || [];
  const chosen = companies.find((c) => c.id === selected);
  const filtered = companies.filter(
    (c) =>
      (filter === "all" || c.contactStatus === filter) &&
      (c.name + " " + c.address).toLowerCase().includes(search.toLowerCase()),
  );
  async function start(limit: number) {
    setBusy(true);
    setNotice("");
    try {
      await api("runs", "POST", {
        city: "Екатеринбург",
        niche: "автосервисы",
        limit,
      });
      setNotice(
        "Поиск поставлен в очередь. Прогресс доступен во вкладке «Запуски».",
      );
      await refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Ошибка запуска");
    } finally {
      setBusy(false);
    }
  }
  async function add(input: CompanyInput) {
    const c = await api<Company>("companies", "POST", input);
    await refresh();
    setManual(false);
    setSelected(c.id);
  }
  const active = runs
    .flatMap((r) => r.jobs)
    .filter((j) => ["running", "pending"].includes(j.status)).length;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          <span className="brand-icon">
            <Icon name="spark" size={23} />
          </span>
          <span>
            ai agent<span className="brand-point">.</span>
          </span>
        </a>
        <div className="sidebar-caption">РАБОЧЕЕ ПРОСТРАНСТВО</div>
        <nav>
          {(
            [
              { id: "companies", label: "Компании", icon: "grid" },
              { id: "runs", label: "Запуски", icon: "clock" },
              { id: "settings", label: "Подключения", icon: "settings" },
            ] as const
          ).map((n) => (
            <button
              key={n.id}
              className={view === n.id ? "nav-item active" : "nav-item"}
              onClick={() => setView(n.id)}
            >
              <Icon name={n.icon} />
              <span>{n.label}</span>
              {n.id === "companies" && (
                <span className="nav-count">{companies.length}</span>
              )}
              {n.id === "runs" && active > 0 && <span className="live-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="eyebrow">ВАШ ПОДХОД</span>
          <p>
            Сначала польза.
            <br />
            Потом предложение.
          </p>
          <small>
            Каждый вывод — с источником.
            <br />
            Каждое обращение — под вашим контролем.
          </small>
        </div>
        <div className="sidebar-bottom">
          <span className="profile-avatar">A</span>
          <div>
            <strong>Моё пространство</strong>
            <small>Автосервисы · Екатеринбург</small>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <span className="breadcrumb">Рабочее пространство</span>
            <span className="breadcrumb-slash">/</span>
            <span>
              {view === "companies"
                ? "Компании"
                : view === "runs"
                  ? "Запуски"
                  : "Подключения"}
            </span>
          </div>
          <div className="topbar-actions">
            <button
              className="logout-button"
              onClick={async () => {
                try {
                  await api("auth/logout", "POST", {});
                  window.location.assign("/login");
                } catch (e) {
                  setNotice(
                    e instanceof Error ? e.message : "Не удалось выйти",
                  );
                }
              }}
            >
              Выйти
            </button>
            <span className="topbar-location">
              <Icon name="pin" size={15} /> Екатеринбург
            </span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                ПОИСК ВОЗМОЖНОСТЕЙ ДЛЯ ВАШЕГО БИЗНЕСА
              </div>
              <h1>
                {view === "companies"
                  ? "Новые клиенты начинаются здесь"
                  : view === "runs"
                    ? "История запусков"
                    : "Подключения и доступ"}
              </h1>
              <p className="muted">
                {view === "companies"
                  ? "Находите автосервисы и превращайте наблюдения в полезные предложения."
                  : view === "runs"
                    ? "Прогресс, источники ошибок и расход ресурсов по каждому запуску."
                    : "Статус сервисов, которые ищут, анализируют и создают референсы."}
              </p>
            </div>
            <span className="workspace-tag">
              <span />
              Личное пространство
            </span>
          </div>
          {data?.testMode && (
            <div className="test-banner">
              ТЕСТОВЫЙ РЕЖИМ · Все результаты этого запуска синтетические
            </div>
          )}
          {loadError && (
            <div className="alert" role="alert">
              {loadError}{" "}
              <button className="text-link" onClick={() => void refresh()}>
                Повторить
              </button>
            </div>
          )}
          {notice && (
            <div className="toast" role="status">
              {notice}
              <button
                className="icon-button"
                aria-label="Скрыть уведомление"
                onClick={() => setNotice("")}
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          )}
          {view === "companies" && (
            <>
              <div className="stats-grid">
                <Stat
                  label="Компаний в работе"
                  value={companies.length}
                  icon="grid"
                  hint="Сохранены в вашем пространстве"
                />
                <Stat
                  label="Анализ подготовлен"
                  value={companies.filter((c) => c.analysis).length}
                  icon="spark"
                  hint="Выводы ждут вашей проверки"
                />
                <Stat
                  label="Вы связались"
                  value={
                    companies.filter((c) => c.contactStatus === "contacted")
                      .length
                  }
                  icon="check"
                  hint="Статус отмечается вручную"
                />
              </div>
              <RunForm onRun={start} busy={busy} />
              {data?.providers.some((p) => !p.available) && (
                <div className="connection-note">
                  <Icon name="link" size={18} />
                  <span>
                    Для автоматического поиска и генерации нужно подключить
                    OpenAI. Компании можно добавлять вручную.
                  </span>
                  <button onClick={() => setView("settings")}>
                    Подключения <Icon name="arrow" size={15} />
                  </button>
                </div>
              )}
              <section className="companies-panel">
                <div className="list-heading">
                  <div>
                    <h2>
                      Компании <span className="count">{companies.length}</span>
                    </h2>
                    <p className="muted">
                      Проверьте факты, подготовьте предложение и выберите
                      следующий шаг.
                    </p>
                  </div>
                  <button className="secondary" onClick={() => setManual(true)}>
                    <Icon name="plus" size={17} />
                    Добавить вручную
                  </button>
                </div>
                <div className="list-toolbar">
                  <div className="filter-tabs">
                    {[
                      { v: "all", l: "Все" },
                      { v: "new", l: "Новые" },
                      { v: "reviewed", l: "Проверены" },
                      { v: "contacted", l: "Связались" },
                      { v: "rejected", l: "Отклонены" },
                    ].map((t) => (
                      <button
                        key={t.v}
                        className={filter === t.v ? "selected" : ""}
                        onClick={() => setFilter(t.v)}
                      >
                        {t.l}
                      </button>
                    ))}
                  </div>
                  <div className="table-search">
                    <Icon name="search" size={16} />
                    <input
                      aria-label="Поиск по компаниям"
                      placeholder="Найти компанию…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </div>
                {!data ? (
                  <div className="loading-state">Загружаем пространство…</div>
                ) : (
                  <CompanyList companies={filtered} onSelect={setSelected} />
                )}
                <footer className="list-footer">
                  <span>
                    Показано {filtered.length} из {companies.length}
                  </span>
                  <span>
                    <Icon name="check" size={14} />
                    Сообщения отправляются только вами
                  </span>
                </footer>
              </section>
            </>
          )}
          {view === "runs" && (
            <section className="runs-panel">
              {!runs.length ? (
                <div className="empty-state">
                  <Icon name="clock" size={32} />
                  <h3>Запусков пока нет</h3>
                  <p>Начните поиск на вкладке «Компании».</p>
                </div>
              ) : (
                runs.map((r) => {
                  const usage =
                    data?.usage.filter((u) => u.runId === r.id) || [];
                  const done = r.jobs.filter(
                    (j) => j.status === "completed",
                  ).length;
                  const live = r.jobs.some((j) =>
                    ["running", "pending"].includes(j.status),
                  );
                  return (
                    <article className="run-card" key={r.id}>
                      <div className="section-heading">
                        <div>
                          <h3>Автосервисы · {r.city}</h3>
                          <span className="muted small-text">
                            {date(r.createdAt)} · Лимит {r.limit} ·{" "}
                            {r.id.slice(0, 8)}
                          </span>
                        </div>
                        {live ? (
                          <button
                            className="secondary small"
                            onClick={async () => {
                              try {
                                await api("runs/" + r.id, "DELETE");
                                await refresh();
                              } catch (e) {
                                setNotice(
                                  e instanceof Error ? e.message : "Ошибка",
                                );
                              }
                            }}
                          >
                            Остановить
                          </button>
                        ) : (
                          <span className="badge neutral">
                            {r.cancelled
                              ? "Отменён"
                              : r.jobs.some((j) => j.status === "blocked")
                                ? "Нужно подключение"
                                : r.jobs.some((j) => j.status === "failed")
                                  ? "С ошибками"
                                  : "Завершён"}
                          </span>
                        )}
                      </div>
                      <div className="run-progress">
                        <span
                          style={{
                            width:
                              (r.jobs.length
                                ? (done / r.jobs.length) * 100
                                : 0) + "%",
                          }}
                        />
                      </div>
                      <div className="run-meta">
                        <span>
                          Завершено этапов: {done} / {r.jobs.length}
                        </span>
                        <span>
                          Попыток запросов: {usage.length} · Токены:{" "}
                          {usage
                            .reduce((a, u) => a + (u.units || 0), 0)
                            .toLocaleString("ru-RU")}{" "}
                          · Стоимость {usage.length ? "неизвестна" : "—"}
                        </span>
                      </div>
                      {r.jobs.map((j) => (
                        <div className={"job-line " + j.status} key={j.id}>
                          <span>
                            <span className="status-dot" />
                            {kindLabels[j.kind]} · {jobLabels[j.status]} ·
                            Попытка {j.attempts}/3
                          </span>
                          {j.error && <small>{j.error}</small>}
                        </div>
                      ))}
                      {live && (
                        <p className="muted small-text">
                          Задания выполняет отдельный worker. Долгое ожидание
                          может означать, что он не запущен.
                        </p>
                      )}
                    </article>
                  );
                })
              )}
            </section>
          )}
          {view === "settings" && (
            <section className="settings-panel">
              <h2>Сервисы агента</h2>
              <p className="muted">
                Ключи хранятся на сервере. Наличие ключа не подтверждает доступ
                к модели — он проверяется при запросе.
              </p>
              <div className="provider-list">
                {data?.providers.map((p) => (
                  <article key={p.name}>
                    <span className="provider-icon">
                      <Icon
                        name={
                          p.name === "Поиск"
                            ? "search"
                            : p.name === "Анализ"
                              ? "spark"
                              : "grid"
                        }
                      />
                    </span>
                    <div>
                      <h3>{p.name}</h3>
                      <p>{p.reason}</p>
                    </div>
                    <span
                      className={"badge " + (p.available ? "green" : "neutral")}
                    >
                      {p.available ? "Ключ задан" : "Не подключён"}
                    </span>
                  </article>
                ))}
              </div>
              <div className="note">
                <strong>Как подключить</strong>
                <p>
                  Добавьте секрет <code>AI_PROVIDER_API_KEY</code> для адреса{" "}
                  <code>api.openai.com</code> в защищённых настройках среды.
                  Нужны доступ к Responses с веб-поиском, генерации изображений
                  и положительный баланс. После применения настроек
                  перезапустите приложение и worker.
                </p>
                <p>
                  Стоимость запросов пока не рассчитывается: сверяйте расходы с
                  биллингом OpenAI. Не вводите ключи в сообщения или карточки
                  компаний.
                </p>
              </div>
              <div className="settings-facts">
                <h3>Как работает поиск</h3>
                <p>
                  2ГИС, Яндекс Карты, каталоги и сайты компаний могут попадать в
                  результаты веб-поиска. Доступность конкретного источника не
                  гарантирована. Прямого массового скачивания карточек нет.
                </p>
                <h3>Перед обращением</h3>
                <p>
                  Проверьте ссылки, принадлежность сайта и персонализацию.
                  Референс — концепт. Отправка сообщений остаётся за вами.
                </p>
              </div>
            </section>
          )}
          <div className="page-foot">
            <span>
              ai agent · Осмысленные предложения для реального бизнеса
            </span>
            <span>Екатеринбург / Автосервисы</span>
          </div>
        </main>
      </div>
      {manual && <ManualForm onClose={() => setManual(false)} onAdd={add} />}{" "}
      {chosen && (
        <CompanyDetail
          key={chosen.id}
          company={chosen}
          runs={runs}
          onClose={() => setSelected(null)}
          onSave={async (patch) => {
            const c = await api<Company>(
              "companies/" + chosen.id,
              "PATCH",
              patch,
            );
            await refresh();
            return c;
          }}
          onOperation={async (kind) => {
            await api("companies/" + chosen.id + "/" + kind, "POST", {});
            await refresh();
          }}
        />
      )}
    </div>
  );
}
function Stat({
  label,
  value,
  icon,
  hint,
}: {
  label: string;
  value: number;
  icon: "grid" | "spark" | "check";
  hint: string;
}) {
  return (
    <article className="stat-card">
      <div>
        <span>{label}</span>
        <div className="stat-value">{value.toLocaleString("ru-RU")}</div>
        <small>{hint}</small>
      </div>
      <div className={"stat-icon " + icon}>
        <Icon name={icon} size={21} />
      </div>
    </article>
  );
}
