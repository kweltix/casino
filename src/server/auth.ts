import {
  randomBytes,
  createHash,
  createHmac,
  timingSafeEqual,
  scrypt,
} from "node:crypto";
import { promisify } from "node:util";
import type { Store } from "./db";
import type { ProviderEnv } from "../providers/contracts";
const derive = promisify(scrypt);
const lifetime = 8 * 60 * 60 * 1000;
const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export function appOrigin(env: ProviderEnv): string | null {
  const raw = env.APP_ORIGIN || env.RENDER_EXTERNAL_URL;
  if (!raw) return null;
  const u = new URL(raw);
  if (
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    u.pathname !== "/" ||
    !["http:", "https:"].includes(u.protocol)
  )
    throw new Error("INVALID_ORIGIN");
  if (
    u.protocol !== "https:" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)
  )
    throw new Error("HTTPS_REQUIRED");
  return u.origin;
}
export function cookieName(env: ProviderEnv = process.env) {
  return appOrigin(env)?.startsWith("https:")
    ? "__Host-ai_agent_session"
    : "ai_agent_session";
}
export function readSessionCookie(
  header: string | null,
  env: ProviderEnv = process.env,
) {
  const name = cookieName(env) + "=";
  return (
    header
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith(name))
      ?.slice(name.length) || ""
  );
}
export function sessionCookie(
  token: string,
  env: ProviderEnv = process.env,
  clear = false,
) {
  return `${cookieName(env)}=${clear ? "" : token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : lifetime / 1000}${appOrigin(env)?.startsWith("https:") ? "; Secure" : ""}`;
}
export class SessionAuth {
  constructor(
    readonly store: Store,
    readonly env: ProviderEnv = process.env,
  ) {}
  get configured() {
    try {
      return (
        !!this.env.APP_PASSWORD &&
        this.env.APP_PASSWORD.length >= 16 &&
        this.env.APP_PASSWORD.length <= 1024 &&
        appOrigin(this.env) !== undefined
      );
    } catch {
      return false;
    }
  }
  private credentialTag(token: string) {
    return createHmac("sha256", this.env.APP_PASSWORD!)
      .update(token)
      .digest("hex");
  }
  isAuthenticated(token: string, now = Date.now()): boolean {
    if (!this.configured || !/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
    const row = this.store.db
      .prepare(
        "SELECT expires_at,credential_tag FROM auth_sessions WHERE token_hash=?",
      )
      .get(tokenHash(token)) as
      | { expires_at: number; credential_tag: string }
      | undefined;
    if (!row || row.expires_at <= now) return false;
    const tag = Buffer.from(row.credential_tag, "hex");
    const expected = Buffer.from(this.credentialTag(token), "hex");
    return tag.length === expected.length && timingSafeEqual(tag, expected);
  }
  async login(
    password: string,
    now = Date.now(),
  ): Promise<{ token: string; expiresAt: number } | null> {
    if (!this.configured) throw new Error("AUTH_NOT_CONFIGURED");
    this.store.db
      .transaction(() => {
        const limit = this.store.db
          .prepare("SELECT attempts,window_start FROM auth_throttle WHERE id=1")
          .get() as { attempts: number; window_start: number } | undefined;
        if (limit && now - limit.window_start < 15 * 60 * 1000) {
          if (limit.attempts >= 5) throw new Error("RATE_LIMIT");
          this.store.db
            .prepare("UPDATE auth_throttle SET attempts=attempts+1 WHERE id=1")
            .run();
        } else
          this.store.db
            .prepare("INSERT OR REPLACE INTO auth_throttle VALUES(1,1,?)")
            .run(now);
      })
      .immediate();
    if (!password || password.length > 1024) return null;
    const salt = "ai-agent-password-verification-v1";
    const [candidate, expected] = (await Promise.all([
      derive(password, salt, 64),
      derive(this.env.APP_PASSWORD!, salt, 64),
    ])) as Buffer[];
    if (!timingSafeEqual(candidate, expected)) return null;
    const token = randomBytes(32).toString("base64url");
    const expiresAt = now + lifetime;
    this.store.db
      .transaction(() => {
        this.store.db
          .prepare("DELETE FROM auth_sessions WHERE expires_at<=?")
          .run(now);
        this.store.db
          .prepare("INSERT INTO auth_sessions VALUES(?,?,?)")
          .run(tokenHash(token), expiresAt, this.credentialTag(token));
        this.store.db.prepare("DELETE FROM auth_throttle WHERE id=1").run();
      })
      .immediate();
    return { token, expiresAt };
  }
  logout(token: string) {
    this.store.db
      .prepare("DELETE FROM auth_sessions WHERE token_hash=?")
      .run(tokenHash(token));
  }
}
