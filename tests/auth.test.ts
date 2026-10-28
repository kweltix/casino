import { afterEach, it, expect } from "vitest";
import { createStore, type Store } from "../src/server/db";
import { SessionAuth, cookieName, sessionCookie } from "../src/server/auth";
import { createApi } from "../src/server/http";
const password = "test-only-long-password-29";
const env = { APP_PASSWORD: password, APP_ORIGIN: "https://agent.example" };
const stores: Store[] = [];
const setup = () => {
  const s = createStore(":memory:");
  stores.push(s);
  return { s, auth: new SessionAuth(s, env), api: createApi(s, env) };
};
afterEach(() => {
  for (const s of stores.splice(0)) s.close();
});
const request = (
  path: string,
  method = "GET",
  body?: unknown,
  token?: string,
  origin = "https://agent.example",
) =>
  new Request("http://localhost:3000/api/" + path, {
    method,
    headers: {
      Host: "agent.example",
      Origin: origin,
      "Content-Type": "application/json",
      ...(token ? { Cookie: cookieName(env) + "=" + token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
it("protects every data API and fails closed without a configured password", async () => {
  const { api, s } = setup();
  for (const path of [
    "workspace",
    "status",
    "companies",
    "runs",
    "companies/x/image",
  ])
    expect((await api(request(path))).status).toBe(401);
  expect(
    (await createApi(s, {})(new Request("http://localhost:3000/api/workspace")))
      .status,
  ).toBe(503);
});
it("issues expiring revocable sessions bound to the current password", async () => {
  const { auth, s } = setup();
  expect(await auth.login("wrong", 1000)).toBeNull();
  const session = await auth.login(password, 2000);
  expect(session).not.toBeNull();
  expect(auth.isAuthenticated(session!.token, 3000)).toBe(true);
  expect(auth.isAuthenticated(session!.token + "bad", 3000)).toBe(false);
  expect(auth.isAuthenticated(session!.token, 2000 + 8 * 60 * 60 * 1000)).toBe(
    false,
  );
  expect(
    new SessionAuth(s, {
      ...env,
      APP_PASSWORD: "changed-password-long-enough",
    }).isAuthenticated(session!.token, 3000),
  ).toBe(false);
  auth.logout(session!.token);
  expect(auth.isAuthenticated(session!.token, 3000)).toBe(false);
});
it("persists login throttling across instances", async () => {
  const { auth, s } = setup();
  for (let i = 0; i < 5; i++)
    expect(await auth.login("wrong", 1000 + i)).toBeNull();
  await expect(new SessionAuth(s, env).login(password, 1010)).rejects.toThrow(
    "RATE_LIMIT",
  );
  expect(await auth.login(password, 1000 + 15 * 60 * 1000 + 10)).not.toBeNull();
});
it("sets secure host-only cookies and permits only the configured public origin", async () => {
  const { api } = setup();
  const result = await api(request("auth/login", "POST", { password }));
  expect(result.status).toBe(200);
  const cookie = result.headers.get("set-cookie")!;
  expect(cookie).toContain("HttpOnly");
  expect(cookie).toContain("Secure");
  expect(cookie).toContain("SameSite=Strict");
  expect(cookie).not.toContain("Domain=");
  const token = cookie.split(";")[0].split("=")[1];
  expect(
    (await api(request("workspace", "GET", undefined, token))).status,
  ).toBe(200);
  expect(
    (
      await api(
        request("runs", "POST", { limit: 1 }, token, "https://evil.example"),
      )
    ).status,
  ).toBe(403);
  const badHost = new Request("http://localhost/api/workspace", {
    headers: { Host: "evil.example", Cookie: cookie.split(";")[0] },
  });
  expect((await api(badHost)).status).toBe(403);
  expect((await api(request("auth/logout", "POST", {}, token))).status).toBe(
    200,
  );
  expect(
    (await api(request("workspace", "GET", undefined, token))).status,
  ).toBe(401);
  expect(sessionCookie("x", env)).toContain("__Host-");
});
it("exposes only a minimal health response without authentication", async () => {
  const { api } = setup();
  expect(await (await api(request("health"))).json()).toEqual({ status: "ok" });
});
