"use client";
import { useState } from "react";
import { Icon } from "./ui";
import type { CompanyInput } from "../domain/validation";
export function ManualForm({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (data: CompanyInput) => Promise<void>;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-title"
        className="modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-heading">
          <h2 id="manual-title">Добавить компанию</h2>
          <button
            className="icon-button"
            aria-label="Закрыть форму"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>
        <p className="muted">
          Сохраните ссылку и сведения, которые вы проверили. Агент не скачивает
          страницу по этой ссылке автоматически.
        </p>
        <form
          className="stack-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            setError("");
            try {
              const site = String(f.get("website") || "").trim();
              await onAdd({
                name: String(f.get("name")),
                address: String(f.get("address")),
                phone: String(f.get("phone") || ""),
                ...(site ? { website: site } : {}),
                sources: [
                  {
                    id: "manual-" + crypto.randomUUID(),
                    url: String(f.get("url")),
                    fetchedAt: new Date().toISOString(),
                    excerpt: String(f.get("excerpt")),
                  },
                ],
              });
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "Не удалось сохранить",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Название
            <input
              name="name"
              required
              maxLength={200}
              placeholder="Название автосервиса"
              autoFocus
            />
          </label>
          <label>
            Адрес
            <input
              name="address"
              required
              minLength={3}
              maxLength={500}
              placeholder="Екатеринбург, улица и дом"
            />
          </label>
          <div className="two-columns">
            <label>
              Телефон, если известен
              <input name="phone" maxLength={100} placeholder="+7 …" />
            </label>
            <label>
              Сайт, если найден
              <input name="website" type="url" placeholder="https://…" />
            </label>
          </div>
          <label>
            Ссылка на источник
            <input
              name="url"
              required
              type="url"
              placeholder="Карточка компании или сайт"
            />
          </label>
          <label>
            Проверенные сведения
            <textarea
              name="excerpt"
              required
              maxLength={8000}
              rows={4}
              placeholder="Что указано в карточке: услуги, фотографии, описание, отзывы. Не добавляйте предположения как факты."
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={onClose}>
              Отмена
            </button>
            <button className="primary" disabled={busy}>
              {busy ? "Сохраняем…" : "Добавить компанию"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
