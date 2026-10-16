import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
const records = vi.hoisted(() => new Map());
vi.mock("../server/store.js", () => ({
  setRecord: vi.fn(async (id, value) => records.set(id, value)),
  getRecord: vi.fn(async (id) => records.get(id) ?? null),
  deleteRecord: vi.fn(async (id) => records.delete(id)),
  takeRecord: vi.fn(async (id) => {
    const value = records.get(id);
    records.delete(id);
    return value;
  }),
  nextNonce: vi.fn(async () => "1790000000000000"),
  loginAttempt: vi.fn(async () => true),
}));
vi.mock("google-auth-library", () => ({
  OAuth2Client: class {
    generateAuthUrl(opts) {
      return (
        "https://accounts.google.com/o/oauth2/v2/auth?" +
        new URLSearchParams(opts)
      );
    }
    async getToken() {
      return {
        tokens: {
          scope: "https://www.googleapis.com/auth/gmail.readonly",
          access_token: "mock-access",
          refresh_token: "mock-refresh",
        },
      };
    }
    setCredentials(tokens) {
      this.credentials = tokens;
    }
    async getAccessToken() {
      return { token: "mock-access" };
    }
    async revokeToken() {
      return {};
    }
  },
}));
import handler from "../server/handler.js";
import { receipt, fixtureSenders } from "./fixtures/receipts.js";
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
});
beforeEach(() => {
  records.clear();
  vi.unstubAllGlobals();
  for (const [key, value] of Object.entries({
    APP_ORIGIN: base,
    NATIVE_APP_ORIGINS: "",
    GOOGLE_CLIENT_ID: "mock-client",
    GOOGLE_CLIENT_SECRET: "mock-secret",
    GOOGLE_REDIRECT_URI: `${base}/api/gmail/callback`,
    GMAIL_NU_SENDERS: fixtureSenders.Nu[0],
    SESSION_SECRET: "mock-session-key-with-32-characters",
    BITSO_OWNER_PASSWORD: "mock-owner-password-long",
  }))
    vi.stubEnv(key, value);
});
const request = (path, options = {}) =>
  fetch(base + path, { redirect: "manual", ...options });
const post = (path, body = {}, cookie) =>
  request(path, {
    method: "POST",
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  });
describe("API y aislamiento de sesiones con proveedores mockeados", () => {
  it("origins nativos explícitos permiten CORS, otros origins se rechazan", async () => {
    vi.stubEnv("NATIVE_APP_ORIGINS", "capacitor://localhost,https://localhost");
    const allowed = await request("/api/status", {
      headers: { Origin: "capacitor://localhost" },
    });
    expect(allowed.headers.get("access-control-allow-origin")).toBe(
      "capacitor://localhost",
    );
    expect(
      (
        await request("/api/status", {
          method: "OPTIONS",
          headers: { Origin: "https://attacker.example" },
        })
      ).status,
    ).toBe(403);
    expect(
      (await post("/api/gmail/native-start", { challenge: "a".repeat(64) }))
        .status,
    ).toBe(403);
  });
  it("OAuth móvil entrega un código de un uso ligado a prueba, nunca tokens de Google", async () => {
    vi.stubEnv("NATIVE_APP_ORIGINS", "capacitor://localhost");
    const verifier = "b".repeat(64),
      challenge = createHash("sha256").update(verifier).digest("hex");
    const mobilePost = (path, body) =>
      request(path, {
        method: "POST",
        headers: {
          Origin: "capacitor://localhost",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    const started = await mobilePost("/api/gmail/native-start", { challenge });
    expect(started.status).toBe(200);
    const { url } = await started.json();
    const connect = await request(new URL(url).pathname + new URL(url).search);
    const state = new URL(connect.headers.get("location")).searchParams.get(
      "state",
    );
    const callback = await request(
      `/api/gmail/callback?state=${state}&code=test`,
      { headers: { Cookie: `cajitas_oauth=${state}` } },
    );
    const target = new URL(callback.headers.get("location"));
    expect(target.protocol).toBe("guardadito:");
    expect(target.hostname).toBe("auth");
    const code = target.searchParams.get("code");
    expect(code).toMatch(/^[a-f0-9]{64}$/);
    expect(target.toString()).not.toContain("mock-access");
    const exchanged = await mobilePost("/api/gmail/native-exchange", {
      code,
      verifier,
    });
    expect(exchanged.status).toBe(200);
    const response = await exchanged.json();
    expect(response.sessionId).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(response)).not.toContain("mock-refresh");
    const status = await request("/api/status", {
      headers: {
        Origin: "capacitor://localhost",
        Authorization: `Bearer ${response.sessionId}`,
      },
    });
    expect((await status.json()).gmailConnected).toBe(true);
    expect(
      (await mobilePost("/api/gmail/native-exchange", { code, verifier }))
        .status,
    ).toBe(403);
    records.set("native-handoff:" + "c".repeat(64), {
      challenge,
      tokens: { access_token: "mock-access" },
    });
    expect(
      (
        await mobilePost("/api/gmail/native-exchange", {
          code: "c".repeat(64),
          verifier: "d".repeat(64),
        })
      ).status,
    ).toBe(403);
  });
  it("rechaza mutaciones sin Origin y balance privado sin sesión", async () => {
    expect((await request("/api/gmail/sync", { method: "POST" })).status).toBe(
      403,
    );
    expect((await request("/api/bitso/balance")).status).toBe(401);
    expect(
      (await post("/api/bitso/login", { password: "incorrecta" })).status,
    ).toBe(401);
  });
  it("resuelve el rewrite serverless y devuelve un estado sin secretos", async () => {
    const response = await request("/api/router?route=status");
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toContain("mock-secret");
    expect(text).toContain("gmailConfigured");
  });
  it("vincula OAuth a un navegador, usa PKCE y rechaza reutilizar el estado", async () => {
    const connect = await request("/api/gmail/connect");
    expect(connect.status).toBe(302);
    const auth = new URL(connect.headers.get("location")),
      state = auth.searchParams.get("state"),
      cookie = `cajitas_oauth=${state}`;
    expect(auth.searchParams.get("code_challenge_method")).toBe("S256");
    expect(auth.searchParams.get("scope")).toBe(
      "https://www.googleapis.com/auth/gmail.readonly",
    );
    expect(
      (await request(`/api/gmail/callback?state=${state}&code=mock-code`))
        .status,
    ).toBe(403);
    const callback = await request(
      `/api/gmail/callback?state=${state}&code=mock-code`,
      { headers: { Cookie: cookie } },
    );
    expect(callback.status).toBe(302);
    const cookies = callback.headers.getSetCookie();
    expect(cookies).toHaveLength(2);
    expect(cookies.join(" ")).toContain("HttpOnly");
    expect(cookies.join(" ")).not.toContain("mock-refresh");
    expect(
      (
        await request(`/api/gmail/callback?state=${state}&code=mock-code`, {
          headers: { Cookie: cookie },
        })
      ).status,
    ).toBe(403);
  });
  it("consulta Gmail con filtro de remitentes y devuelve solo depósitos anonimizados", async () => {
    const id = "a".repeat(64);
    records.set(`session:${id}`, { tokens: { access_token: "mock-access" } });
    const upstream = vi.fn(async (url) => ({
      ok: true,
      json: async () =>
        url.includes("?format=full")
          ? receipt()
          : { messages: [{ id: "fixture-message" }] },
    }));
    vi.stubGlobal("fetch", upstream);
    // Keep the real HTTP client while mocking server-side upstream calls.
    const { default: http } = await import("node:http");
    const result = await new Promise((resolve, reject) => {
      const req = http.request(
        base + "/api/gmail/sync",
        {
          method: "POST",
          headers: {
            Origin: base,
            "Content-Type": "application/json",
            Cookie: `cajitas_session=${id}`,
          },
        },
        (res) => {
          let body = "";
          res.on("data", (chunk) => (body += chunk));
          res.on("end", () =>
            resolve({ status: res.statusCode, body: JSON.parse(body) }),
          );
        },
      );
      req.on("error", reject);
      req.end("{}");
    });
    expect(result.status).toBe(200);
    expect(result.body.receipts[0].amountCents).toBe(125050);
    const q = new URL(upstream.mock.calls[0][0]).searchParams.get("q");
    expect(q).toContain(`from:${fixtureSenders.Nu[0]}`);
    expect(q).toContain("newer_than:90d");
    expect(JSON.stringify(result.body)).not.toContain("DEMO-001");
  });
});
