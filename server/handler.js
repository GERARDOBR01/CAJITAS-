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
  const id =
    nativeRequest(req) && req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : cookies(req).cajitas_session;
  if (!/^[a-f0-9]{64}$/.test(id ?? "")) return null;
  const record = await getRecord(`session:${id}`);
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
    const native = nativeRequest(req);
    if (native) {
      res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization",
      );
    }
    if (method === "OPTIONS") {
      res.statusCode = native ? 204 : 403;
      return res.end();
    }
    // Mutations require same-origin JSON requests. OAuth callback has its own state binding.
    if (
      method === "POST" &&
      ((!native && req.headers.origin !== origin()) ||
        !req.headers["content-type"]?.startsWith("application/json"))
    )
      throw problem("Solicitud no autorizada.", 403);
    if (route === "/api/gmail/native-start" && method === "POST") {
      if (!native) throw problem("Conexión móvil no autorizada.", 403);
      oauth();
      if (!Object.values(configuredSenders()).flat().length)
        throw problem("Configura los remitentes exactos en el servidor.", 503);
      const body = await readBody(req);
      if (!/^[a-f0-9]{64}$/.test(body.challenge ?? ""))
        throw problem("Solicitud de conexión inválida.");
      const ticket = opaque();
      await setRecord(
        `native-ticket:${ticket}`,
        { challenge: body.challenge },
        600,
      );
      return json(res, 200, {
        url: `${origin()}/api/gmail/connect?native=${ticket}`,
      });
    }
    if (route === "/api/gmail/native-exchange" && method === "POST") {
      if (!native) throw problem("Conexión móvil no autorizada.", 403);
      const body = await readBody(req);
      if (
        !/^[a-f0-9]{64}$/.test(body.code ?? "") ||
        !/^[a-f0-9]{64}$/.test(body.verifier ?? "")
      )
        throw problem("Conexión inválida.");
      const handoff = await takeRecord(`native-handoff:${body.code}`);
      if (
        !handoff ||
        createHash("sha256").update(body.verifier).digest("hex") !==
          handoff.challenge
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
      const current = await session(req);
      const senders = configuredSenders();
      return json(res, 200, {
        gmailConnected: Boolean(current?.tokens),
        bitsoAuthorized: Boolean(current?.bitso),
        gmailConfigured: Boolean(
          process.env.GOOGLE_CLIENT_ID &&
            process.env.GOOGLE_CLIENT_SECRET &&
            process.env.GOOGLE_REDIRECT_URI &&
            Object.values(senders).flat().length,
        ),
        bitsoConfigured: Boolean(
          process.env.BITSO_API_KEY &&
            process.env.BITSO_API_SECRET &&
            process.env.BITSO_OWNER_PASSWORD,
        ),
        patternsValidated: false,
      });
    }
    if (route === "/api/gmail/connect" && method === "GET") {
      const senders = Object.values(configuredSenders()).flat();
      if (!senders.length)
        throw problem(
          "Configura los remitentes exactos de tus comprobantes en el servidor.",
          503,
        );
      const client = oauth(),
        state = opaque(),
        verifier = opaque();
      let nativeChallenge;
      if (url.searchParams.has("native")) {
        const ticket = url.searchParams.get("native");
        if (!/^[a-f0-9]{64}$/.test(ticket ?? ""))
          throw problem("Conexión inválida.");
        const record = await takeRecord(`native-ticket:${ticket}`);
        if (!record) throw problem("La conexión expiró.", 403);
        nativeChallenge = record.challenge;
      }
      await setRecord(`oauth:${state}`, { verifier, nativeChallenge }, 600);
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
      if (url.searchParams.has("error"))
        return redirect(
          res,
          transaction.nativeChallenge
            ? "cajitas://auth?error=cancelled"
            : `${origin()}/?gmail=cancelled`,
        );
      const client = oauth();
      const { tokens } = await client.getToken({
        code: url.searchParams.get("code"),
        codeVerifier: transaction.verifier,
      });
      if (!tokens.scope?.split(" ").includes(scopes[0]))
        throw problem("Gmail no concedió el permiso de lectura.", 403);
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
        { tokens: previous?.tokens, bitso: true },
        86400,
      );
      if (previous) await deleteRecord(`session:${previous.id}`);
      if (!native) cookie(res, "cajitas_session", id, 86400);
      return json(res, 200, { ok: true, ...(native ? { sessionId: id } : {}) });
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
