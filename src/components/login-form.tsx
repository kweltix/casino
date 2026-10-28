"use client";
import { useState } from "react";
import { Icon } from "./ui";
export function LoginForm({ configured }: { configured: boolean }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand">
          <span className="brand-icon">
            <Icon name="spark" />
          </span>
          <span>ai agent.</span>
        </div>
        <h1>Ваше рабочее пространство</h1>
        <p className="muted">
          Войдите, чтобы искать компании и готовить предложения.
        </p>
        {configured ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              setBusy(true);
              const password = String(
                new FormData(e.currentTarget).get("password") || "",
              );
              try {
                const r = await fetch("/api/auth/login", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ password }),
                });
                if (!r.ok) {
                  const data = await r.json();
                  setError(data.error || "Не удалось войти");
                } else window.location.assign("/");
              } catch {
                setError("Не удалось связаться с приложением");
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Пароль
              <input
                type="password"
                name="password"
                required
                maxLength={1024}
                autoComplete="current-password"
                autoFocus
              />
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="primary" disabled={busy}>
              {busy ? "Входим…" : "Войти"}
              <Icon name="arrow" size={16} />
            </button>
          </form>
        ) : (
          <div className="note">
            <strong>Доступ ещё не настроен</strong>
            <p>
              Владелец приложения должен задать пароль в защищённых настройках
              сервера. До этого данные закрыты.
            </p>
          </div>
        )}
        <small>Личное пространство · Автосервисы Екатеринбурга</small>
      </section>
    </main>
  );
}
