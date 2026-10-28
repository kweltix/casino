"use client";
import { useState } from "react";
import type { Company, ContactStatus, Run } from "../domain/types";
import { Icon, date, contactLabels, jobLabels, kindLabels } from "./ui";
export function CompanyDetail({
  company,
  runs,
  onClose,
  onSave,
  onOperation,
}: {
  company: Company;
  runs: Run[];
  onClose: () => void;
  onSave: (patch: {
    version: number;
    draftMessage: string;
    contactStatus: ContactStatus;
  }) => Promise<Company>;
  onOperation: (kind: "analyze" | "concept") => Promise<void>;
}) {
  const [text, setText] = useState(company.draftMessage);
  const [status, setStatus] = useState(company.contactStatus);
  const [version, setVersion] = useState(company.version);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const jobs = runs
    .flatMap((r) => r.jobs)
    .filter((j) => j.payload.companyId === company.id);
  const active = jobs.some(
    (j) => j.status === "pending" || j.status === "running",
  );
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : "Не удалось выполнить действие",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="company-title"
        className="drawer"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-top">
          <span className="section-kicker">КАРТОЧКА КОМПАНИИ</span>
          <button
            className="icon-button"
            aria-label="Закрыть карточку"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>
        <h2 id="company-title">{company.name}</h2>
        <p className="address">
          <Icon name="pin" size={16} />
          {company.address}
        </p>
        <div className="detail-tags">
          <span className="badge neutral">
            {company.origin === "manual"
              ? "Добавлена вручную"
              : company.origin === "test"
                ? "Тестовые данные"
                : "Веб-поиск"}
          </span>
          <span className="muted">Обновлено {date(company.updatedAt)}</span>
        </div>
        {company.phone && <p>Телефон: {company.phone}</p>}
        {company.website && (
          <a
            className="text-link"
            href={company.website}
            target="_blank"
            rel="noreferrer"
          >
            Перейти на найденный сайт <Icon name="external" size={14} />
          </a>
        )}
        <section className="detail-section">
          <div className="section-heading">
            <h3>Проверка и анализ</h3>
            <button
              className="secondary small"
              disabled={busy || active}
              onClick={() => void act(() => onOperation("analyze"))}
            >
              <Icon name="spark" size={16} />
              {company.analysis ? "Повторить анализ" : "Проанализировать"}
            </button>
          </div>
          {company.websiteExplanation && (
            <div className="note">
              <strong>
                {company.websiteStatus === "found"
                  ? "Сайт найден"
                  : company.websiteStatus === "not_found"
                    ? "Сайт не найден при проверке"
                    : "Наличие сайта не подтверждено"}
              </strong>
              <p>{company.websiteExplanation}</p>
              {company.websiteCheckedAt && (
                <small>Проверено {date(company.websiteCheckedAt)}</small>
              )}
            </div>
          )}
          {company.analysis ? (
            <>
              <div className="observations">
                {company.analysis.observations.length ? (
                  company.analysis.observations.map((o, i) => (
                    <article key={i}>
                      <span className="observation-number">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <p>{o.text}</p>
                        <div className="source-refs">
                          {o.sourceIds.map((id) => {
                            const s = company.sources.find((x) => x.id === id);
                            return s ? (
                              <a
                                href={s.url}
                                target="_blank"
                                rel="noreferrer"
                                key={id}
                              >
                                Источник <Icon name="external" size={12} />
                              </a>
                            ) : null;
                          })}
                        </div>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="muted">
                    Подтверждённых недостатков недостаточно для предложения.
                  </p>
                )}
              </div>
              <div className="note">
                <strong>Что ещё нужно проверить</strong>
                <ul>
                  {company.analysis.uncertainties.map((u, i) => (
                    <li key={i}>{u}</li>
                  ))}
                </ul>
              </div>
              {company.analysis.competitorSourceIds.length > 0 && (
                <p className="muted">
                  Источников для сравнения с конкурентами:{" "}
                  {company.analysis.competitorSourceIds.length}
                </p>
              )}
            </>
          ) : (
            <p className="muted">
              Агент проверит собственный сайт, доступные сведения и конкурентов.
              Выводы появятся после завершения задания.
            </p>
          )}
          {jobs.slice(-4).map((j) => (
            <div key={j.id} className={"job-line " + j.status}>
              <span>
                {kindLabels[j.kind]} · {jobLabels[j.status]}
              </span>
              {j.error && <small>{j.error}</small>}
            </div>
          ))}
        </section>
        <section className="detail-section">
          <h3>
            Источники <span className="count">{company.sources.length}</span>
          </h3>
          <p className="muted small-text">
            Для веб-поиска сохранён машинный пересказ. Для ручного ввода —
            предоставленные вами сведения.
          </p>
          <div className="sources">
            {company.sources.map((s) => (
              <details key={s.id}>
                <summary>
                  <span>{new URL(s.url).hostname}</span>
                  <span className="muted">{date(s.fetchedAt)}</span>
                </summary>
                <p>{s.excerpt || "Описание не добавлено"}</p>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-link"
                >
                  Открыть источник <Icon name="external" size={13} />
                </a>
              </details>
            ))}
          </div>
        </section>
        <section className="detail-section">
          <div className="section-heading">
            <h3>Личное предложение</h3>
            <span className="badge purple">25–35 тыс. ₽</span>
          </div>
          <p className="muted small-text">
            Проверьте факты и тон сообщения перед обращением.
          </p>
          <label className="sr-only" htmlFor="draft">
            Текст сообщения
          </label>
          <textarea
            id="draft"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            maxLength={8000}
            placeholder="Здесь появится черновик после анализа. Можно написать свой текст."
          />
          {version !== company.version && (
            <div className="note">
              <p>Карточка обновилась. Ваш текст сохранён в редакторе.</p>
              <button
                className="text-link"
                onClick={() => {
                  setText(company.draftMessage);
                  setStatus(company.contactStatus);
                  setVersion(company.version);
                }}
              >
                Загрузить актуальную версию
              </button>
            </div>
          )}
          <div className="editor-actions">
            <button
              className="secondary small"
              disabled={!text}
              onClick={() =>
                void act(async () => {
                  await navigator.clipboard.writeText(text);
                  setNotice("Текст скопирован");
                })
              }
            >
              <Icon name="copy" size={15} />
              Копировать
            </button>
            <select
              aria-label="Статус обращения"
              value={status}
              onChange={(e) => setStatus(e.target.value as ContactStatus)}
            >
              {Object.entries(contactLabels).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <button
              className="primary small"
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  const saved = await onSave({
                    version,
                    draftMessage: text,
                    contactStatus: status,
                  });
                  setVersion(saved.version);
                  setNotice("Изменения сохранены");
                })
              }
            >
              Сохранить
            </button>
          </div>
          <p className="muted small-text">
            Отправляете вы. Статус «Связались» отмечается вручную.
          </p>
        </section>
        <section className="detail-section">
          <div className="section-heading">
            <h3>Концепт сайта</h3>
            <button
              className="secondary small"
              disabled={busy || active || !company.analysis}
              onClick={() => void act(() => onOperation("concept"))}
            >
              <Icon name="spark" size={15} />
              {company.image ? "Создать заново" : "Создать референс"}
            </button>
          </div>
          {company.image ? (
            <>
              <img
                className="concept-image"
                alt={"Концепт сайта для " + company.name}
                src={
                  "/api/companies/" +
                  company.id +
                  "/image?v=" +
                  company.image.fileName
                }
              />
              <p className="muted small-text">
                Концепт, не существующий сайт. Проверьте текст и детали перед
                отправкой.
              </p>
            </>
          ) : (
            <div className="concept-empty">
              <Icon name="grid" size={26} />
              <p>Визуальный пример первого экрана</p>
              <span>Генерируется отдельно после проверки анализа</span>
            </div>
          )}
        </section>
        {notice && (
          <div className="drawer-notice" role="status">
            {notice}
          </div>
        )}
      </aside>
    </div>
  );
}
