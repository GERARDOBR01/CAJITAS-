import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { getRates } from "./banxico.js";
import { getBitsoBalance } from "./bitso.js";
import { configuredSenders, parseDeposit } from "./parser.js";
import {
  setRecord,
  getRecord,
  deleteRecord,
  takeRecord,
  nextNonce,
  loginAttempt,
} from "./store.js";
const opaque = () => randomBytes(32).toString("hex");
const problem = (message, status = 400) =>
  Object.assign(new Error(message), { status });
const scopes = ["https://www.googleapis.com/auth/gmail.readonly"];
function nativeRequest(req) {
  const permitted = (process.env.NATIVE_APP_ORIGINS ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter((v) => ["capacitor://localhost", "https://localhost"].includes(v));
  return permitted.includes(req.headers.origin);
}
function origin() {
  const raw = process.env.APP_ORIGIN ?? "http://localhost:5173";
  const url = new URL(raw);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:")
    throw problem("APP_ORIGIN debe usar HTTPS.", 503);
  return url.origin;
}
function webAppUrl() {
  try {
    const url = new URL(process.env.WEB_APP_URL);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !url.hostname.includes(".") ||
      /^[\d.]+$/.test(url.hostname) ||
      url.hostname.includes(":") ||
      /(^|\.)(localhost|local|internal|test|invalid|example)$/.test(
        url.hostname,
      )
    )
      return null;
    return url;
  } catch {
    return null;
  }
}
function webRequest(req) {
  const web = webAppUrl();
  return Boolean(
    web && web.origin !== origin() && req.headers.origin === web.origin,
  );
}
export function gmailReadiness(web = false) {
  const missing = [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REDIRECT_URI",
  ].filter((key) => !process.env[key]);
  if (process.env.GOOGLE_REDIRECT_URI) {
    try {
      const callback = new URL(process.env.GOOGLE_REDIRECT_URI);
      if (
        callback.origin !== origin() ||
        callback.pathname !== "/api/gmail/callback" ||
        callback.search ||
        callback.hash
      )
        missing.push("GOOGLE_REDIRECT_URI");
    } catch {
      missing.push("GOOGLE_REDIRECT_URI");
    }
  }
  if (!Object.values(configuredSenders()).flat().length)
    missing.push("GMAIL_SENDERS");
  if ((process.env.SESSION_SECRET ?? "").length < 32)
    missing.push("SESSION_SECRET");
  if (process.env.NODE_ENV === "production" || process.env.VERCEL)
    for (const key of ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"])
      if (!process.env[key]) missing.push(key);
  if (web && !webAppUrl()) missing.push("WEB_APP_URL");
  return { ready: !missing.length, missing };
}
function requireGmail(web = false) {
  if (!gmailReadiness(web).ready)
    throw problem(
      "Completa la configuración de Gmail y las sesiones en el servidor para conectar tu correo.",
      503,
    );
}
function cookies(req) {
  return Object.fromEntries(
    (req.headers.cookie ?? "").split(";").map((p) => p.trim().split("=")),
  );
}
function cookie(res, name, value, maxAge = 2592000) {
  const previous = res.getHeader("Set-Cookie") ?? [];
  res.setHeader("Set-Cookie", [
    ...(Array.isArray(previous) ? previous : [previous]),
    `${name}=${value}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${origin().startsWith("https:") ? "; Secure" : ""}`,
  ]);
}
function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}
function redirect(res, url) {
  res.statusCode = 302;
  res.setHeader("Location", url);
  res.end();
}
function oauth() {
  if (
    !process.env.GOOGLE_CLIENT_ID ||
    !process.env.GOOGLE_CLIENT_SECRET ||
    !process.env.GOOGLE_REDIRECT_URI
  )
    throw problem(
      "Configura Gmail OAuth en el servidor para conectar tu correo.",
      503,
    );
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
}
async function session(req) {
  const app = nativeRequest(req) || webRequest(req);
  const id = app
    ? req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : null
    : cookies(req).cajitas_session;
  if (!/^[a-f0-9]{64}$/.test(id ?? "")) return null;
  const record = await getRecord(`session:${id}`);
  if (
    record?.webOrigin &&
    (!webRequest(req) || record.webOrigin !== req.headers.origin)
  )
    return null;
  if (webRequest(req) && record && record.webOrigin !== req.headers.origin)
    return null;
  return record ? { id, ...record } : null;
}
async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 4096) throw problem("Solicitud demasiado grande.", 413);
  }
  try {
    return JSON.parse(body || "{}");
  } catch {
    throw problem("JSON inválido.");
  }
}
async function gmailFetch(url, client) {
  const { token } = await client.getAccessToken();
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw problem(
      "Gmail no pudo responder. Vuelve a conectar si tu autorización expiró.",
      502,
    );
  return response.json();
}
let ratesCache;
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  try {
    const url = new URL(req.url, origin()),
      route =
        url.pathname === "/api/router"
          ? `/api/${url.searchParams.get("route") ?? ""}`
          : url.pathname,
      method = req.method;
    const native = nativeRequest(req),
      web = webRequest(req),
      app = native || web;
    if (app) {
      res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization",
      );
    }
    if (method === "OPTIONS") {
      res.statusCode = app ? 204 : 403;
      return res.end();
    }
    if (req.headers.origin && !app && req.headers.origin !== origin())
      throw problem("Solicitud no autorizada.", 403);
    // Cross-origin app requests use an explicitly allowed origin and opaque bearer.
    // OAuth navigation keeps its state cookie on the backend's own origin.
    if (
      method === "POST" &&
      ((!app && req.headers.origin !== origin()) ||
        !req.headers["content-type"]?.startsWith("application/json"))
    )
      throw problem("Solicitud no autorizada.", 403);
    if (
      ["/api/gmail/native-start", "/api/gmail/app-start"].includes(route) &&
      method === "POST"
    ) {
      if (!app || (route.endsWith("native-start") && !native))
        throw problem("Conexión de aplicación no autorizada.", 403);
      requireGmail(web);
      const body = await readBody(req);
      if (!/^[a-f0-9]{64}$/.test(body.challenge ?? ""))
        throw problem("Solicitud de conexión inválida.");
      const callback = web ? webAppUrl() : null;
      if (web && body.callbackUrl !== callback.href)
        throw problem("El destino de la conexión no está autorizado.", 403);
      const ticket = opaque();
      await setRecord(
        `${web ? "app" : "native"}-ticket:${ticket}`,
        {
          challenge: body.challenge,
          ...(web
            ? { callbackUrl: callback.href, webOrigin: callback.origin }
            : {}),
        },
        600,
      );
      return json(res, 200, {
        url: `${origin()}/api/gmail/connect?${web ? "app" : "native"}=${ticket}`,
      });
    }
    if (
      ["/api/gmail/native-exchange", "/api/gmail/app-exchange"].includes(
        route,
      ) &&
      method === "POST"
    ) {
      if (!app || (route.endsWith("native-exchange") && !native))
        throw problem("Conexión de aplicación no autorizada.", 403);
      const body = await readBody(req);
      if (
        !/^[a-f0-9]{64}$/.test(body.code ?? "") ||
        !/^[a-f0-9]{64}$/.test(body.verifier ?? "")
      )
        throw problem("Conexión inválida.");
      const handoff = await takeRecord(
        `${web ? "app" : "native"}-handoff:${body.code}`,
      );
      if (
        !handoff ||
        createHash("sha256").update(body.verifier).digest("hex") !==
          handoff.challenge ||
        (web &&
          (handoff.webOrigin !== req.headers.origin ||
            handoff.callbackUrl !== webAppUrl()?.href))
      )
        throw problem(
          "La conexión expiró o no corresponde a este dispositivo.",
          403,
        );
      const previous = await session(req),
        id = opaque();
      await setRecord(`session:${id}`, {
        tokens: handoff.tokens,
        bitso: previous?.bitso ?? false,
        ...(web ? { webOrigin: req.headers.origin } : {}),
      });
      if (previous) await deleteRecord(`session:${previous.id}`);
      return json(res, 200, { sessionId: id });
    }
    if (route === "/api/rates" && method === "GET") {
      if (!ratesCache || ratesCache.expires < Date.now())
        ratesCache = { value: await getRates(), expires: Date.now() + 300000 };
      return json(res, 200, ratesCache.value);
    }
    if (route === "/api/status" && method === "GET") {
      const readiness = gmailReadiness(web);
      // Report incomplete session configuration even if an old client sends a bearer.
      const sessionMissing = readiness.missing.some((key) =>
        [
          "SESSION_SECRET",
          "UPSTASH_REDIS_REST_URL",
          "UPSTASH_REDIS_REST_TOKEN",
        ].includes(key),
      );
      const current = sessionMissing ? null : await session(req);
      return json(res, 200, {
        apiConfigured: true,
        gmailConnected: Boolean(current?.tokens),
        bitsoAuthorized: Boolean(current?.bitso),
        gmailConfigured: readiness.ready,
        gmailReadiness: readiness,
        webBridgeConfigured: Boolean(webAppUrl()),
        webReadiness: gmailReadiness(true),
        bitsoConfigured: Boolean(
          process.env.BITSO_API_KEY &&
            process.env.BITSO_API_SECRET &&
            process.env.BITSO_OWNER_PASSWORD,
        ),
        patternsValidated: false,
      });
    }
    if (route === "/api/gmail/connect" && method === "GET") {
      requireGmail();
      const client = oauth(),
        state = opaque(),
        verifier = opaque();
      let nativeChallenge, webConnection;
      if (url.searchParams.has("native") && url.searchParams.has("app"))
        throw problem("Conexión inválida.");
      if (url.searchParams.has("native")) {
        const ticket = url.searchParams.get("native");
        if (!/^[a-f0-9]{64}$/.test(ticket ?? ""))
          throw problem("Conexión inválida.");
        const record = await takeRecord(`native-ticket:${ticket}`);
        if (!record) throw problem("La conexión expiró.", 403);
        nativeChallenge = record.challenge;
      }
      if (url.searchParams.has("app")) {
        const ticket = url.searchParams.get("app");
        if (!/^[a-f0-9]{64}$/.test(ticket ?? ""))
          throw problem("Conexión inválida.");
        const record = await takeRecord(`app-ticket:${ticket}`),
          callback = webAppUrl();
        if (
          !record ||
          !callback ||
          record.callbackUrl !== callback.href ||
          record.webOrigin !== callback.origin
        )
          throw problem(
            "La conexión expiró o su destino no está autorizado.",
            403,
          );
        webConnection = record;
      }
      await setRecord(
        `oauth:${state}`,
        { verifier, nativeChallenge, webConnection },
        600,
      );
      cookie(res, "cajitas_oauth", state, 600);
      return redirect(
        res,
        client.generateAuthUrl({
          access_type: "offline",
          prompt: "consent",
          scope: scopes,
          state,
          code_challenge: createHash("sha256")
            .update(verifier)
            .digest("base64url"),
          code_challenge_method: "S256",
        }),
      );
    }
    if (route === "/api/gmail/callback" && method === "GET") {
      const state = url.searchParams.get("state");
      if (
        !/^[a-f0-9]{64}$/.test(state ?? "") ||
        state !== cookies(req).cajitas_oauth
      )
        throw problem("La conexión expiró. Intenta conectar de nuevo.", 403);
      const transaction = await takeRecord(`oauth:${state}`);
      if (!transaction) throw problem("La conexión expiró.", 403);
      cookie(res, "cajitas_oauth", "", 0);
      const callback = transaction.webConnection ? webAppUrl() : null;
      if (
        transaction.webConnection &&
        (!callback ||
          transaction.webConnection.callbackUrl !== callback.href ||
          transaction.webConnection.webOrigin !== callback.origin)
      )
        throw problem("El destino de la conexión ya no está autorizado.", 403);
      if (url.searchParams.has("error"))
        return redirect(
          res,
          transaction.nativeChallenge
            ? "cajitas://auth?error=cancelled"
            : callback
              ? `${callback.href}#cajitas-auth-error=cancelled`
              : `${origin()}/?gmail=cancelled`,
        );
      const client = oauth();
      const { tokens } = await client.getToken({
        code: url.searchParams.get("code"),
        codeVerifier: transaction.verifier,
      });
      if (!tokens.scope?.split(" ").includes(scopes[0]))
        throw problem("Gmail no concedió el permiso de lectura.", 403);
      if (callback) {
        const code = opaque();
        await setRecord(
          `app-handoff:${code}`,
          { ...transaction.webConnection, tokens },
          60,
        );
        return redirect(res, `${callback.href}#cajitas-auth=${code}`);
      }
      if (transaction.nativeChallenge) {
        const code = opaque();
        await setRecord(
          `native-handoff:${code}`,
          { challenge: transaction.nativeChallenge, tokens },
          60,
        );
        return redirect(res, `cajitas://auth?code=${code}`);
      }
      const previous = await session(req),
        id = opaque();
      await setRecord(`session:${id}`, {
        tokens,
        bitso: previous?.bitso ?? false,
      });
      if (previous) await deleteRecord(`session:${previous.id}`);
      cookie(res, "cajitas_session", id);
      return redirect(res, `${origin()}/?gmail=connected`);
    }
    if (route === "/api/gmail/sync" && method === "POST") {
      const current = await session(req);
      if (!current?.tokens) throw problem("Conecta tu Gmail primero.", 401);
      const body = await readBody(req);
      if (
        body.pageToken &&
        (typeof body.pageToken !== "string" || body.pageToken.length > 1024)
      )
        throw problem("Página inválida.");
      const senders = configuredSenders(),
        client = oauth();
      client.setCredentials(current.tokens);
      const q = `newer_than:90d {${Object.values(senders)
        .flat()
        .map((s) => `from:${s}`)
        .join(" ")}}`;
      const params = new URLSearchParams({
        q,
        maxResults: "20",
        ...(body.pageToken ? { pageToken: body.pageToken } : {}),
      });
      const list = await gmailFetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
        client,
      );
      const receipts = [];
      let ignored = 0;
      // Batches limit both serverless runtime and concurrent Gmail requests.
      for (let i = 0; i < (list.messages ?? []).length; i += 5) {
        const messages = await Promise.all(
          list.messages
            .slice(i, i + 5)
            .map((m) =>
              gmailFetch(
                `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(m.id)}?format=full`,
                client,
              ),
            ),
        );
        for (const message of messages) {
          const parsed = parseDeposit(message, { senders });
          if (parsed) receipts.push(parsed);
          else ignored++;
        }
      }
      await setRecord(`session:${current.id}`, {
        tokens: client.credentials,
        bitso: current.bitso ?? false,
        ...(current.webOrigin ? { webOrigin: current.webOrigin } : {}),
      });
      return json(res, 200, {
        receipts,
        nextPageToken: list.nextPageToken ?? null,
        ignored,
      });
    }
    if (route === "/api/gmail/disconnect" && method === "POST") {
      const current = await session(req);
      if (current?.tokens) {
        const token =
          current.tokens.refresh_token ?? current.tokens.access_token;
        if (token)
          await oauth()
            .revokeToken(token)
            .catch(() => {});
        await setRecord(`session:${current.id}`, {
          bitso: current.bitso ?? false,
          ...(current.webOrigin ? { webOrigin: current.webOrigin } : {}),
        });
      }
      return json(res, 200, { ok: true });
    }
    if (route === "/api/bitso/login" && method === "POST") {
      const configured = process.env.BITSO_OWNER_PASSWORD;
      if (!configured || configured.length < 16)
        throw problem(
          "Configura una contraseña de acceso a Bitso de al menos 16 caracteres en el servidor.",
          503,
        );
      const ip = String(
        req.headers["x-forwarded-for"] ??
          req.socket?.remoteAddress ??
          "unknown",
      ).split(",")[0];
      if (!(await loginAttempt(createHash("sha256").update(ip).digest("hex"))))
        throw problem("Demasiados intentos. Espera 15 minutos.", 429);
      const body = await readBody(req);
      const expected = createHash("sha256").update(configured).digest(),
        actual = createHash("sha256")
          .update(String(body.password ?? ""))
          .digest();
      if (!timingSafeEqual(expected, actual))
        throw problem("Contraseña incorrecta.", 401);
      const previous = await session(req),
        id = opaque();
      await setRecord(
        `session:${id}`,
        {
          tokens: previous?.tokens,
          bitso: true,
          ...(web ? { webOrigin: req.headers.origin } : {}),
        },
        86400,
      );
      if (previous) await deleteRecord(`session:${previous.id}`);
      if (!app) cookie(res, "cajitas_session", id, 86400);
      return json(res, 200, { ok: true, ...(app ? { sessionId: id } : {}) });
    }
    if (route === "/api/bitso/balance" && method === "GET") {
      const current = await session(req);
      if (!current?.bitso)
        throw problem("Inicia sesión para consultar tu saldo de Bitso.", 401);
      return json(
        res,
        200,
        await getBitsoBalance({ nonce: await nextNonce() }),
      );
    }
    if (route === "/api/bitso/logout" && method === "POST") {
      const current = await session(req);
      if (current)
        await setRecord(`session:${current.id}`, {
          tokens: current.tokens,
          bitso: false,
          ...(current.webOrigin ? { webOrigin: current.webOrigin } : {}),
        });
      return json(res, 200, { ok: true });
    }
    return json(res, 404, { error: "Ruta no encontrada." });
  } catch (error) {
    // Do not serialize upstream OAuth/SDK errors; these can contain tokens and request headers.
    return json(res, error.status ?? 502, {
      error: error.status
        ? error.message
        : "No se pudo completar la consulta. Revisa la configuración del servidor e intenta de nuevo.",
    });
  }
}
