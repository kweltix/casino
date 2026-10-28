"use client";
import { useState } from "react";
import { Icon } from "./ui";
export function RunForm({
  onRun,
  busy,
}: {
  onRun: (limit: number) => Promise<void>;
  busy: boolean;
}) {
  const [limit, setLimit] = useState(20);
  return (
    <section className="search-panel">
      <div className="section-kicker">
        <span className="tiny-dot" /> НОВЫЙ ПОИСК
      </div>
      <h2>Найдём бизнес, которому вы можете помочь</h2>
      <p className="muted">
        Агент изучит открытые источники и подготовит предложения. Решение об
        обращении — за вами.
      </p>
      <form
        className="search-fields"
        onSubmit={(e) => {
          e.preventDefault();
          void onRun(limit);
        }}
      >
        <label>
          Город
          <div className="input-icon">
            <Icon name="pin" />
            <input value="Екатеринбург" readOnly />
          </div>
        </label>
        <label>
          Ниша
          <div className="input-icon">
            <Icon name="search" />
            <input value="Автосервисы" readOnly />
          </div>
        </label>
        <label className="limit-field">
          Компаний
          <input
            type="number"
            min="1"
            max="20"
            value={limit}
            required
            onChange={(e) => setLimit(Number(e.target.value))}
          />
        </label>
        <button
          className="primary"
          disabled={busy || !Number.isInteger(limit) || limit < 1 || limit > 20}
        >
          <Icon name="spark" />
          {busy ? "Запускаем…" : "Найти компании"}
          <Icon name="arrow" size={17} />
        </button>
      </form>
      <div className="panel-foot">
        <span>
          2ГИС, Яндекс Карты, каталоги и сайты компаний — через веб-поиск
        </span>
        <span>До 20 компаний за запуск</span>
      </div>
    </section>
  );
}
