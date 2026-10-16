import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createServer } from "node:http";
import { createHash, webcrypto } from "node:crypto";

const state = vi.hoisted(() => ({
  records: new Map(),
  expires: new Map(),
  native: false,
  preferences: new Map(),
  browserOpen: vi.fn(),
  browserClose: vi.fn(async () => {}),
  listeners: new Map(),
  tokenCalls: vi.fn(),
}));
vi.mock("../server/store.js", () => ({
  setRecord: vi.fn(async (id, value, ttl = 2592000) => {
    state.records.set(id, value);
    state.expires.set(id, Date.now() + ttl * 1000);
  }),
  getRecord: vi.fn(async (id) =>
    state.expires.get(id) <= Date.now()
      ? null
      : (state.records.get(id) ?? null),
  ),
  deleteRecord: vi.fn(async (id) => state.records.delete(id)),
  takeRecord: vi.fn(async (id) => {
    const value =
      state.expires.get(id) <= Date.now() ? null : state.records.get(id);
    state.records.delete(id);
    return value;
  }),
  nextNonce: vi.fn(async () => "1790000000000000"),
  loginAttempt: vi.fn(async () => true),
}));
vi.mock("google-auth-library", () => ({
  OAuth2Client: class {
    generateAuthUrl(options) {
      return (
        "https://accounts.google.com/o/oauth2/v2/auth?" +
        new URLSearchParams(options)
      );
    }
    async getToken(options) {
      state.tokenCalls(options);
      return {
        tokens: {
          scope: "https://www.googleapis.com/auth/gmail.readonly",
          access_token: "provider-access-secret",
          refresh_token: "provider-refresh-secret",
        },
      };
    }
    setCredentials(tokens) {
      this.credentials = tokens;
    }
    async revokeToken() {}
  },
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => state.native,
    getPlatform: () => (state.native ? "android" : "web"),
  },
}));
vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    get: vi.fn(async ({ key }) => ({
      value: state.preferences.get(key) ?? null,
    })),
    set: vi.fn(async ({ key, value }) => state.preferences.set(key, value)),
    remove: vi.fn(async ({ key }) => state.preferences.delete(key)),
  },
}));
vi.mock("@capacitor/browser", () => ({
  Browser: { open: state.browserOpen, close: state.browserClose },
}));
vi.mock("@capacitor/app", () => ({
  App: {
    addListener: vi.fn(async (event, listener) =>
      state.listeners.set(event, listener),
    ),
    getLaunchUrl: vi.fn(async () => null),
  },
}));
import handler from "../server/handler.js";
import { setRecord } from "../server/store.js";

const webBase = "https://cajitas.github.io/CAJITAS-/",
  webOrigin = new URL(webBase).origin;
const verifier = "b".repeat(64),
  challenge = createHash("sha256").update(verifier).digest("hex");
const originalFetch = globalThis.fetch;
let server, base;
beforeAll(async () => {
  server = createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  state.records.clear();
  state.expires.clear();
  state.preferences.clear();
  state.listeners.clear();
  state.native = false;
  for (const [key, value] of Object.entries({
    APP_ORIGIN: base,
    WEB_APP_URL: webBase,
    NATIVE_APP_ORIGINS: "capacitor://localhost",
    GOOGLE_CLIENT_ID: "client-id",
    GOOGLE_CLIENT_SECRET: "client-secret",
    GOOGLE_REDIRECT_URI: `${base}/api/gmail/callback`,
    GMAIL_NU_SENDERS: "comprobantes@nu.example",
    GMAIL_MP_SENDERS: "",
    SESSION_SECRET: "a-session-secret-with-at-least-32-characters",
    UPSTASH_REDIS_REST_URL: "",
    UPSTASH_REDIS_REST_TOKEN: "",
    VERCEL: "",
    NODE_ENV: "test",
    VITE_API_ORIGIN: "",
    MODE: "test",
    BASE_URL: "/",
  }))
    vi.stubEnv(key, value);
});
const request = (path, options = {}) =>
  originalFetch(base + path, { redirect: "manual", ...options });
const post = (path, body, origin = webOrigin, extraHeaders = {}) =>
  request(path, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
async function handoff() {
  const start = await post("/api/gmail/app-start", {
    challenge,
    callbackUrl: webBase,
  });
  expect(start.status).toBe(200);
  const target = new URL((await start.json()).url);
  const connect = await request(target.pathname + target.search);
  const oauthState = new URL(connect.headers.get("location")).searchParams.get(
    "state",
  );
  const callback = await request(
    `/api/gmail/callback?state=${oauthState}&code=google-code`,
    {
      headers: { Cookie: `cajitas_oauth=${oauthState}` },
    },
  );
  return {
    callback,
    oauthState,
    code: new URLSearchParams(
      new URL(callback.headers.get("location")).hash.slice(1),
    ).get("cajitas-auth"),
  };
}

describe("puente OAuth para web externa con proveedores simulados", () => {
  it("permite solo el origen web exacto y el destino completo configurados", async () => {
    const allowed = await request("/api/status", {
      method: "OPTIONS",
      headers: { Origin: webOrigin },
    });
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get("access-control-allow-origin")).toBe(webOrigin);
    expect(allowed.headers.has("access-control-allow-credentials")).toBe(false);
    for (const origin of [
      "https://attacker.invalid",
      webOrigin + ".attacker.com",
      "null",
    ])
      expect(
        (
          await post(
            "/api/gmail/app-start",
            { challenge, callbackUrl: webBase },
            origin,
          )
        ).status,
      ).toBe(403);
    for (const callbackUrl of [
      webOrigin + "/",
      webBase + "?next=evil",
      "https://attacker.com/CAJITAS-/",
      webBase + "other/",
    ])
      expect(
        (await post("/api/gmail/app-start", { challenge, callbackUrl })).status,
      ).toBe(403);
    expect(state.records.size).toBe(0);
    expect((await post("/api/gmail/native-start", { challenge })).status).toBe(
      403,
    );
  });
  it("consume el ticket una vez y exige la cookie de estado del navegador OAuth", async () => {
    const started = await post("/api/gmail/app-start", {
      challenge,
      callbackUrl: webBase,
    });
    const target = new URL((await started.json()).url);
    const results = await Promise.all([
      request(target.pathname + target.search),
      request(target.pathname + target.search),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([302, 403]);
    const auth = new URL(
      results.find((r) => r.status === 302).headers.get("location"),
    );
    expect(auth.searchParams.get("code_challenge_method")).toBe("S256");
    expect(
      (
        await request(
          `/api/gmail/callback?state=${auth.searchParams.get("state")}&code=google-code`,
        )
      ).status,
    ).toBe(403);
    expect(state.tokenCalls).not.toHaveBeenCalled();
  });
  it("redirige con código efímero en fragmento y conserva tokens solo en el servidor", async () => {
    const { callback, code, oauthState } = await handoff();
    expect(callback.status).toBe(302);
    const target = new URL(callback.headers.get("location"));
    expect(target.origin + target.pathname).toBe(webBase);
    expect(target.search).toBe("");
    expect(code).toMatch(/^[a-f0-9]{64}$/);
    expect(callback.headers.getSetCookie()).toHaveLength(1);
    expect(target.href).not.toContain("provider-");
    expect(setRecord).toHaveBeenCalledWith(
      `app-handoff:${code}`,
      expect.objectContaining({ webOrigin, callbackUrl: webBase, challenge }),
      60,
    );
    const exchanged = await post("/api/gmail/app-exchange", { code, verifier });
    expect(exchanged.status).toBe(200);
    expect(exchanged.headers.has("set-cookie")).toBe(false);
    const body = await exchanged.json();
    expect(Object.keys(body)).toEqual(["sessionId"]);
    expect(body.sessionId).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(body)).not.toContain("provider-");
    expect(
      state.records.get(`session:${body.sessionId}`).tokens.refresh_token,
    ).toBe("provider-refresh-secret");
    const status = await request("/api/status", {
      headers: { Origin: webOrigin, Authorization: `Bearer ${body.sessionId}` },
    });
    expect((await status.json()).gmailConnected).toBe(true);
    const cookieOnly = await request("/api/status", {
      headers: {
        Origin: webOrigin,
        Cookie: `cajitas_session=${body.sessionId}`,
      },
    });
    expect((await cookieOnly.json()).gmailConnected).toBe(false);
    expect(
      (
        await request("/api/status", {
          headers: {
            Origin: "https://attacker.com",
            Authorization: `Bearer ${body.sessionId}`,
          },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await post("/api/gmail/disconnect", {}, webOrigin, {
          Authorization: `Bearer ${body.sessionId}`,
        })
      ).status,
    ).toBe(200);
    expect(state.records.get(`session:${body.sessionId}`)).toEqual({
      bitso: false,
      webOrigin,
    });
    expect(
      (await post("/api/gmail/app-exchange", { code, verifier })).status,
    ).toBe(403);
    expect(
      (
        await request(`/api/gmail/callback?state=${oauthState}&code=again`, {
          headers: { Cookie: `cajitas_oauth=${oauthState}` },
        })
      ).status,
    ).toBe(403);
  });
  it("rechaza la prueba equivocada, su reutilización y códigos de más de 60 segundos", async () => {
    const first = await handoff();
    expect(
      (
        await post("/api/gmail/app-exchange", {
          code: first.code,
          verifier: "c".repeat(64),
        })
      ).status,
    ).toBe(403);
    expect(
      (await post("/api/gmail/app-exchange", { code: first.code, verifier }))
        .status,
    ).toBe(403);
    const second = await handoff(),
      now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now + 61000);
    expect(
      (await post("/api/gmail/app-exchange", { code: second.code, verifier }))
        .status,
    ).toBe(403);
  });
  it("no usa destinos de tickets si WEB_APP_URL cambia después del inicio", async () => {
    const started = await post("/api/gmail/app-start", {
      challenge,
      callbackUrl: webBase,
    });
    const target = new URL((await started.json()).url);
    vi.stubEnv("WEB_APP_URL", "https://other.github.io/CAJITAS-/");
    expect((await request(target.pathname + target.search)).status).toBe(403);
  });
  it("informa los nombres de configuración faltante sin credenciales", async () => {
    for (const name of [
      "GOOGLE_CLIENT_SECRET",
      "SESSION_SECRET",
      "GMAIL_NU_SENDERS",
    ])
      vi.stubEnv(name, "");
    const response = await request("/api/status", {
      headers: { Origin: webOrigin },
    });
    const status = await response.json();
    expect(status.gmailConfigured).toBe(false);
    expect(status.gmailReadiness.missing).toEqual(
      expect.arrayContaining([
        "GOOGLE_CLIENT_SECRET",
        "SESSION_SECRET",
        "GMAIL_SENDERS",
      ]),
    );
    expect(JSON.stringify(status)).not.toContain("client-id");
    expect(
      (await post("/api/gmail/app-start", { challenge, callbackUrl: webBase }))
        .status,
    ).toBe(503);
    expect(state.records.size).toBe(0);
  });
  it("diagnostica Redis de producción y WEB_APP_URL inválido", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ORIGIN", "https://api.cajitas.app");
    vi.stubEnv(
      "GOOGLE_REDIRECT_URI",
      "https://api.cajitas.app/api/gmail/callback",
    );
    vi.stubEnv("WEB_APP_URL", "http://localhost/CAJITAS-/");
    const status = await (await request("/api/status")).json();
    expect(status.gmailConfigured).toBe(false);
    expect(status.webBridgeConfigured).toBe(false);
    expect(status.gmailReadiness.missing).toEqual([
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
    ]);
    expect(status.webReadiness.missing).toContain("WEB_APP_URL");
  });
  it("no anuncia Gmail listo con una redirección distinta al callback del backend", async () => {
    for (const callback of [
      webBase,
      `${base}/api/gmail/callback?next=other`,
      "not-a-url",
    ]) {
      vi.stubEnv("GOOGLE_REDIRECT_URI", callback);
      const status = await (await request("/api/status")).json();
      expect(status.gmailConfigured).toBe(false);
      expect(status.gmailReadiness.missing).toContain("GOOGLE_REDIRECT_URI");
    }
  });
  it("conserva la ruta móvil con su prueba y sesión opaca", async () => {
    const started = await post(
      "/api/gmail/native-start",
      { challenge },
      "capacitor://localhost",
    );
    const target = new URL((await started.json()).url),
      connect = await request(target.pathname + target.search);
    const oauthState = new URL(
      connect.headers.get("location"),
    ).searchParams.get("state");
    const callback = await request(
      `/api/gmail/callback?state=${oauthState}&code=google-code`,
      { headers: { Cookie: `cajitas_oauth=${oauthState}` } },
    );
    const result = new URL(callback.headers.get("location"));
    expect(result.origin).toBe("null");
    expect(result.protocol + "//" + result.hostname).toBe("guardadito://auth");
    const exchange = await post(
      "/api/gmail/native-exchange",
      { code: result.searchParams.get("code"), verifier },
      "capacitor://localhost",
    );
    expect(exchange.status).toBe(200);
    expect((await exchange.json()).sessionId).toMatch(/^[a-f0-9]{64}$/);
  });
});

function browser(hash = "") {
  const values = new Map(),
    win = new EventTarget();
  const location = {
    origin: webOrigin,
    pathname: "/CAJITAS-/",
    search: "",
    hash,
    assign: vi.fn(),
  };
  win.location = location;
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const history = {
    state: null,
    replaceState: vi.fn(() => {
      location.hash = "";
    }),
  };
  vi.stubGlobal("window", win);
  vi.stubGlobal("sessionStorage", storage);
  vi.stubGlobal("history", history);
  vi.stubGlobal("crypto", webcrypto);
  return { values, win, location, history };
}
async function platform() {
  vi.resetModules();
  return import("../src/platform.js");
}
describe("cliente web y móvil del puente", () => {
  it("Pages sin backend responde estado local y no llama /api ni navega", async () => {
    const b = browser(),
      fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    vi.stubEnv("MODE", "pages");
    const client = await platform();
    expect(await client.api("status")).toMatchObject({
      apiConfigured: false,
      gmailConfigured: false,
    });
    await expect(client.connectGmail()).rejects.toThrow("sin conexión");
    expect(fetch).not.toHaveBeenCalled();
    expect(b.location.assign).not.toHaveBeenCalled();
    state.native = true;
    expect(await (await platform()).api("status")).toMatchObject({
      apiConfigured: false,
      gmailConfigured: false,
    });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("Pages configurado guarda la prueba antes de navegar al backend sin cookies", async () => {
    const b = browser(),
      apiOrigin = "https://api.cajitas.app";
    vi.stubEnv("MODE", "pages");
    vi.stubEnv("BASE_URL", "/CAJITAS-/");
    vi.stubEnv("VITE_API_ORIGIN", apiOrigin);
    const fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        url: apiOrigin + "/api/gmail/connect?app=" + "a".repeat(64),
      }),
    }));
    vi.stubGlobal("fetch", fetch);
    b.location.assign.mockImplementation(() =>
      expect(b.values.has("guardadito:web-oauth:" + apiOrigin)).toBe(true),
    );
    const client = await platform();
    await client.connectGmail();
    const [url, options] = fetch.mock.calls[0],
      sent = JSON.parse(options.body);
    expect(url).toBe(apiOrigin + "/api/gmail/app-start");
    expect(options.credentials).toBe("omit");
    expect(sent.callbackUrl).toBe(webBase);
    const proof = JSON.parse(b.values.get("guardadito:web-oauth:" + apiOrigin));
    expect(sent.challenge).toBe(
      createHash("sha256").update(proof.verifier).digest("hex"),
    );
    expect(b.location.assign).toHaveBeenCalledWith(
      apiOrigin + "/api/gmail/connect?app=" + "a".repeat(64),
    );
    expect(state.preferences.size).toBe(0);
  });
  it("retira el fragmento, intercambia con prueba y usa solo sesión opaca del tab", async () => {
    const code = "a".repeat(64),
      sessionId = "c".repeat(64),
      apiOrigin = "https://api.cajitas.app";
    const b = browser("#cajitas-auth=" + code),
      events = [];
    vi.stubEnv("VITE_API_ORIGIN", apiOrigin);
    b.values.set(
      "guardadito:web-oauth:" + apiOrigin,
      JSON.stringify({ verifier, expires: Date.now() + 600000 }),
    );
    b.win.addEventListener("guardadito:connection", (event) =>
      events.push(event.detail),
    );
    const fetch = vi.fn(async () => {
      expect(b.location.hash).toBe("");
      return { ok: true, json: async () => ({ sessionId }) };
    });
    vi.stubGlobal("fetch", fetch);
    const client = await platform();
    await client.setupNativeEvents();
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ code, verifier });
    expect(b.history.replaceState).toHaveBeenCalledWith(null, "", "/CAJITAS-/");
    expect(events).toEqual([{ connected: true }]);
    // Startup can finish before React attaches its event listener.
    expect(client.consumeConnectionResult()).toEqual({ connected: true });
    expect(client.consumeConnectionResult()).toBeNull();
    expect(b.values.get("guardadito:web-session:" + apiOrigin)).toBe(sessionId);
    expect(b.values.has("guardadito:web-oauth:" + apiOrigin)).toBe(false);
    await client.api("status");
    expect(fetch.mock.calls[1][1].headers.Authorization).toBe(
      "Bearer " + sessionId,
    );
    expect(fetch.mock.calls[1][1].credentials).toBe("omit");
  });
  it("el retorno sin prueba válida se limpia sin solicitar el intercambio", async () => {
    const b = browser("#cajitas-auth=" + "a".repeat(64)),
      events = [],
      fetch = vi.fn();
    vi.stubEnv("VITE_API_ORIGIN", "https://api.cajitas.app");
    vi.stubGlobal("fetch", fetch);
    b.win.addEventListener("guardadito:connection", (event) =>
      events.push(event.detail),
    );
    await (await platform()).setupNativeEvents();
    expect(b.location.hash).toBe("");
    expect(fetch).not.toHaveBeenCalled();
    expect(events[0].error).toContain("expiró");
  });
  it("rechaza backends web HTTP, privados o con rutas antes de navegar", async () => {
    const b = browser(),
      fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    for (const url of [
      "http://api.cajitas.app",
      "https://localhost",
      "https://127.0.0.1",
      "https://api.cajitas.app/api",
      "https://user:pass@api.cajitas.app",
    ]) {
      vi.stubEnv("VITE_API_ORIGIN", url);
      const client = await platform();
      expect(await client.api("status")).toMatchObject({
        apiConfigured: false,
      });
      await expect(client.connectGmail()).rejects.toThrow("no es válida");
    }
    expect(fetch).not.toHaveBeenCalled();
    expect(b.location.assign).not.toHaveBeenCalled();
  });
  it("mantiene cookies same-origin y Preferences para las sesiones móviles", async () => {
    const b = browser(),
      fetch = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
    vi.stubGlobal("fetch", fetch);
    const sameOrigin = await platform();
    await sameOrigin.api("status");
    await sameOrigin.connectGmail();
    expect(fetch.mock.calls[0][0]).toBe("/api/status");
    expect(fetch.mock.calls[0][1].credentials).toBe("same-origin");
    expect(b.location.assign).toHaveBeenCalledWith("/api/gmail/connect");
    state.native = true;
    vi.stubEnv("VITE_API_ORIGIN", "https://api.cajitas.app");
    state.preferences.set("guardadito:native-session", "e".repeat(64));
    await (await platform()).api("status");
    expect(fetch.mock.calls[1][1].headers.Authorization).toBe(
      "Bearer " + "e".repeat(64),
    );
    expect(fetch.mock.calls[1][1].credentials).toBe("omit");
  });
  it("guarda la prueba móvil en Preferences e intercambia el deep link sin tokens de Google", async () => {
    const b = browser(),
      events = [],
      apiOrigin = "https://api.cajitas.app";
    state.native = true;
    vi.stubEnv("VITE_API_ORIGIN", apiOrigin);
    b.win.addEventListener("guardadito:connection", (event) =>
      events.push(event.detail),
    );
    const fetch = vi.fn(async (url) => ({
      ok: true,
      json: async () =>
        url.endsWith("native-start")
          ? { url: apiOrigin + "/api/gmail/connect?native=" + "a".repeat(64) }
          : { sessionId: "e".repeat(64) },
    }));
    vi.stubGlobal("fetch", fetch);
    const client = await platform();
    await client.connectGmail();
    const proof = JSON.parse(state.preferences.get("guardadito:native-oauth"));
    expect(proof.verifier).toMatch(/^[a-f0-9]{64}$/);
    expect(state.browserOpen).toHaveBeenCalledWith({
      url: apiOrigin + "/api/gmail/connect?native=" + "a".repeat(64),
    });
    expect(b.values.size).toBe(0);
    await client.setupNativeEvents();
    await state.listeners.get("appUrlOpen")({
      url: "guardadito://auth?code=" + "c".repeat(64),
    });
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({
      code: "c".repeat(64),
      verifier: proof.verifier,
    });
    expect(events).toEqual([{ connected: true }]);
    expect(state.preferences.get("guardadito:native-session")).toBe(
      "e".repeat(64),
    );
    expect(state.preferences.has("guardadito:native-oauth")).toBe(false);
    expect(state.browserClose).toHaveBeenCalled();
  });
});
