import { test, expect } from "@playwright/test";
test("search, review, edit, generate and cancel persist across reloads", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByText("ТЕСТОВЫЙ РЕЖИМ", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Найти компании", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Открыть Тестовый автосервис" }),
  ).toBeVisible({ timeout: 25000 });
  await page
    .getByRole("button", { name: "Открыть Тестовый автосервис" })
    .click();
  await expect(
    page.getByText(
      "В карточке перечислены услуги, но не указаны ориентировочные цены.",
      { exact: true },
    ),
  ).toBeVisible();
  if (
    await page
      .getByRole("button", { name: "Загрузить актуальную версию" })
      .isVisible()
  )
    await page
      .getByRole("button", { name: "Загрузить актуальную версию" })
      .click();
  await page
    .getByLabel("Текст сообщения")
    .fill("Здравствуйте! Предлагаю обсудить сайт вашего автосервиса.");
  await page.getByLabel("Статус обращения").selectOption("reviewed");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByText("Изменения сохранены")).toBeVisible();
  await page
    .getByRole("button", { name: "Создать референс", exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: "Концепт сайта для Тестовый автосервис" }),
  ).toBeVisible({ timeout: 15000 });
  const image = page.getByRole("img", {
    name: "Концепт сайта для Тестовый автосервис",
  });
  await expect(image).toHaveJSProperty("naturalWidth", 1);
  await page.getByRole("button", { name: "Закрыть карточку" }).click();
  await page.reload();
  await page
    .getByRole("button", { name: "Открыть Тестовый автосервис" })
    .click();
  await expect(page.getByLabel("Текст сообщения")).toHaveValue(
    "Здравствуйте! Предлагаю обсудить сайт вашего автосервиса.",
  );
  await page.getByRole("button", { name: "Закрыть карточку" }).click();
  await page
    .getByRole("button", { name: "Найти компании", exact: true })
    .click();
  await page.getByRole("button", { name: "Запуски", exact: false }).click();
  const stop = page
    .getByRole("button", { name: "Остановить", exact: true })
    .first();
  await stop.click();
  await expect(page.getByText("Отменён", { exact: true })).toBeVisible();
});
test("manual entry and narrow viewport remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Добавить вручную" }).click();
  await page
    .getByRole("textbox", { name: "Название", exact: true })
    .fill("Ручной сервис");
  await page
    .getByRole("textbox", { name: "Адрес", exact: true })
    .fill("Екатеринбург, Тестовая, 10");
  await page
    .getByRole("textbox", { name: "Ссылка на источник" })
    .fill("https://example.test/manual");
  await page
    .getByRole("textbox", { name: "Проверенные сведения" })
    .fill(
      "Диагностика и ремонт автомобилей. Сведения введены вручную для теста.",
    );
  await page
    .getByRole("button", { name: "Добавить компанию", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ручной сервис" }),
  ).toBeVisible();
  await expect(
    page.getByText("Добавлена вручную", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Закрыть карточку" }).click();
  await expect(
    page.getByRole("button", { name: "Открыть Ручной сервис" }),
  ).toBeAttached();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
