import { randomBytes } from "node:crypto";
import { parseEnv } from "node:util";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  chmodSync,
  existsSync,
} from "node:fs";
const path = ".env.local";
const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
const saved = parseEnv(existing).APP_PASSWORD;
const configured = process.env.APP_PASSWORD ?? saved;
if (configured) {
  if (configured.length < 16 || configured.length > 1024) {
    console.error(
      "Существующий APP_PASSWORD должен иметь длину от 16 до 1024 символов. Исправьте его в защищённых настройках. Значение сохранено.",
    );
    process.exit(1);
  }
  console.log("Пароль уже настроен; существующие настройки сохранены.");
  process.exit(0);
}
if (process.env.APP_PASSWORD === "") {
  console.error(
    "Удалите пустую переменную APP_PASSWORD из окружения перед локальной генерацией.",
  );
  process.exit(1);
}
if (existsSync("data/admin-access.txt")) {
  console.error(
    "Приватный файл доступа уже существует. Восстановите APP_PASSWORD из него вручную; файл не заменён.",
  );
  process.exit(1);
}
const password = randomBytes(24).toString("base64url");
mkdirSync("data", { recursive: true });
const credentials =
  "AI Agent — локальный доступ\nПароль: " +
  password +
  "\n\nХраните этот файл приватно. Не добавляйте его в Git и не отправляйте в чат.\n";
writeFileSync("data/admin-access.txt", credentials, {
  mode: 0o600,
  flag: "wx",
});
const assignment = /^[ \t]*(?:export[ \t]+)?APP_PASSWORD[ \t]*=.*$/gm;
const content = assignment.test(existing)
  ? existing.replace(assignment, "APP_PASSWORD=" + password)
  : existing +
    (existing && !existing.endsWith("\n") ? "\n" : "") +
    "APP_PASSWORD=" +
    password +
    "\n";
writeFileSync(path, content, { mode: 0o600 });
chmodSync(path, 0o600);
console.log(
  "Локальный пароль создан. Данные для входа: data/admin-access.txt. Значение не выводилось в журнал. Перезапустите сервер.",
);
