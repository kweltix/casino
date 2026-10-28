"use client";
import type { Company } from "../domain/types";
import { Icon, contactLabels } from "./ui";
const siteLabel = {
  found: "Сайт найден",
  not_found: "Не найден при проверке",
  unknown: "Сайт не проверен",
};
export function CompanyList({
  companies,
  onSelect,
}: {
  companies: Company[];
  onSelect: (id: string) => void;
}) {
  if (!companies.length)
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <Icon name="search" size={30} />
        </div>
        <h3>Здесь появятся ваши кандидаты</h3>
        <p>
          Запустите поиск или добавьте компанию по ссылке.
          <br />
          Для каждого наблюдения агент сохранит источник.
        </p>
        <div className="empty-steps">
          <span>
            <b>01</b> Найти
          </span>
          <i />
          <span>
            <b>02</b> Проверить
          </span>
          <i />
          <span>
            <b>03</b> Предложить
          </span>
        </div>
      </div>
    );
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Компания</th>
            <th>Собственный сайт</th>
            <th>Готовность</th>
            <th>Статус</th>
            <th>
              <span className="sr-only">Открыть</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {companies.map((c) => (
            <tr key={c.id}>
              <td>
                <button className="company-name" onClick={() => onSelect(c.id)}>
                  <span className="company-avatar">
                    {c.name[0].toUpperCase()}
                  </span>
                  <span>
                    <strong>{c.name}</strong>
                    <small>{c.address}</small>
                    {c.origin === "test" && (
                      <small className="error">Тестовая компания</small>
                    )}
                  </span>
                </button>
              </td>
              <td>
                <span className={"site-status " + c.websiteStatus}>
                  <span className="status-dot" />
                  {siteLabel[c.websiteStatus]}
                </span>
              </td>
              <td>
                {c.analysis ? (
                  <span
                    className={
                      "badge " +
                      (c.analysis.suitability === "high" ? "green" : "neutral")
                    }
                  >
                    {c.analysis.suitability === "high"
                      ? "Подходит"
                      : c.analysis.suitability === "medium"
                        ? "Нужна проверка"
                        : "Мало оснований"}
                  </span>
                ) : (
                  <span className="muted">Ожидает анализа</span>
                )}
              </td>
              <td>
                <span className={"badge " + c.contactStatus}>
                  {contactLabels[c.contactStatus]}
                </span>
              </td>
              <td>
                <button
                  className="icon-button"
                  aria-label={"Открыть " + c.name}
                  onClick={() => onSelect(c.id)}
                >
                  <Icon name="chevron" size={17} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
