import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { messageFor, sendPush, verifyUser } from "../server/push.js";

const NOW = Date.parse("2026-10-18T20:00:00Z");
const pair = { members: ["g", "j"], names: { g: "Gerardo", j: "Jade" } };
const unsigned = (claims) =>
  [{ alg: "none", typ: "JWT" }, claims]
    .map((part) => Buffer.from(JSON.stringify(part)).toString("base64url"))
    .join(".") + ".";

describe("qué dice cada aviso", () => {
  const deposit = (extra) => ({
    from: "j",
    to: "g",
    goalName: "Viaje",
    cents: 20000,
    status: "pending",
    createdAt: NOW - 1000,
    ...extra,
  });
  it("un depósito por confirmar le llega al guardián", () => {
    expect(
      messageFor({
        kind: "deposit",
        item: deposit(),
        caller: "j",
        pair,
        now: NOW,
      }),
    ).toEqual({
      to: "g",
      title: "Por confirmar",
      body: "Jade dice que te mandó $200.00 para Viaje. ¿Te llegó?",
    });
    expect(
      messageFor({
        kind: "deposit",
        item: deposit({ cents: -5000 }),
        caller: "j",
        pair,
        now: NOW,
      }).body,
    ).toBe("Jade te pide $50.00 de Viaje.");
  });
  it("la respuesta del guardián le llega a quien depositó", () => {
    const answered = (status) =>
      messageFor({
        kind: "deposit",
        item: deposit({ status, decidedAt: NOW - 500 }),
        caller: "g",
        pair,
        now: NOW,
      });
    expect(answered("confirmed")).toMatchObject({
      to: "j",
      body: "Gerardo confirmó tu depósito: +$200.00 para Viaje.",
    });
    expect(answered("rejected").body).toContain("todavía no ve tus $200.00");
    expect(answered("pending")).toBeNull();
  });
  it("nadie avisa en nombre del otro ni repite avisos viejos", () => {
    expect(
      messageFor({
        kind: "deposit",
        item: deposit(),
        caller: "g",
        pair,
        now: NOW,
      }),
    ).toBeNull();
    expect(
      messageFor({
        kind: "deposit",
        item: deposit({ createdAt: NOW - 11 * 60 * 1000 }),
        caller: "j",
        pair,
        now: NOW,
      }),
    ).toBeNull();
  });
  it("las sorpresas no dicen qué traen", () => {
    const gift = (kind, extra) =>
      messageFor({
        kind: "gift",
        item: {
          from: "g",
          to: "j",
          kind,
          createdAt: NOW,
          text: "secreto",
          ...extra,
        },
        caller: "g",
        pair,
        now: NOW,
      });
    expect(gift("note").body).toBe("Gerardo te dejó una notita 💌");
    expect(gift("note").body).not.toContain("secreto");
    expect(gift("reward", { threshold: 50, goalName: "Viaje" }).body).toContain(
      "al 50 % de Viaje",
    );
    expect(gift("pet").body).toContain("mascota especial");
  });
  it("un aporte a la cajita de los dos", () => {
    expect(
      messageFor({
        kind: "entry",
        item: { by: "g", cents: 30000, createdAt: NOW },
        caller: "g",
        pair,
        goalName: "Cancún",
        now: NOW,
      }),
    ).toMatchObject({ to: "j", body: "Gerardo apartó $300.00 para Cancún 🎉" });
    expect(
      messageFor({
        kind: "entry",
        item: { by: "g", cents: -100, createdAt: NOW },
        caller: "g",
        pair,
        now: NOW,
      }),
    ).toBeNull();
  });
});

describe("el servidor de avisos", () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env.VAPID_PUBLIC_KEY = "pub";
    process.env.VAPID_PRIVATE_KEY = "priv";
    process.env.FIRESTORE_EMULATOR_HOST = "firestore.test";
  });
  afterEach(() => {
    process.env = { ...env };
  });
  const doc = (path, fields) => ({
    name: `projects/p/databases/(default)/documents/${path}`,
    fields,
  });
  const s = (v) => ({ stringValue: v });
  const n = (v) => ({ integerValue: String(v) });
  function firestore(depositFields) {
    const calls = [];
    const fetchImpl = vi.fn(async (url, init = {}) => {
      calls.push([url, init.method ?? "GET"]);
      const json = (body, status = 200) => ({
        ok: status < 400,
        status,
        json: async () => body,
      });
      if (url.endsWith("/pairs/g_j"))
        return json(
          doc("pairs/g_j", {
            members: { arrayValue: { values: [s("g"), s("j")] } },
            names: { mapValue: { fields: { g: s("Gerardo"), j: s("Jade") } } },
          }),
        );
      if (url.endsWith("/deposits/d1"))
        return json(doc("pairs/g_j/deposits/d1", depositFields));
      if (url.endsWith(":runQuery"))
        return json([
          {
            document: doc("pairs/g_j/devices/phone", {
              uid: s("g"),
              endpoint: s("https://web.push.apple.com/abc"),
              p256dh: s("key"),
              auth: s("secret"),
            }),
          },
          { readTime: "x" },
        ]);
      if (init.method === "DELETE") return json({});
      return json({}, 404);
    });
    return { fetchImpl, calls };
  }
  const deposit = {
    from: s("j"),
    to: s("g"),
    goalName: s("Viaje"),
    cents: n(20000),
    status: s("pending"),
    createdAt: n(NOW),
  };
  const bearer = `Bearer ${unsigned({ sub: "j" })}`;

  it("pide sesión y no acepta tokens sin firma fuera del emulador", async () => {
    await expect(verifyUser("")).rejects.toMatchObject({ status: 401 });
    delete process.env.FIRESTORE_EMULATOR_HOST;
    await expect(verifyUser(bearer)).rejects.toMatchObject({ status: 401 });
  });
  it("manda el aviso a los teléfonos de la pareja, una sola vez", async () => {
    const { fetchImpl, calls } = firestore(deposit);
    const send = vi.fn(async () => {});
    const body = { pairId: "g_j", kind: "deposit", id: "d1" };
    expect(await sendPush(bearer, body, { send, fetchImpl, now: NOW })).toEqual(
      {
        sent: 1,
      },
    );
    const [subscription, payload, options] = send.mock.calls[0];
    expect(subscription).toEqual({
      endpoint: "https://web.push.apple.com/abc",
      keys: { p256dh: "key", auth: "secret" },
    });
    expect(JSON.parse(payload).body).toContain(
      "Jade dice que te mandó $200.00",
    );
    expect(options.vapidDetails.privateKey).toBe("priv");
    // Every read went with Jade's own session.
    expect(
      calls.every(([url]) => url.startsWith("http://firestore.test/")),
    ).toBe(true);
    expect(
      fetchImpl.mock.calls.every(([, init]) =>
        init.headers.Authorization.startsWith("Bearer "),
      ),
    ).toBe(true);
    expect(await sendPush(bearer, body, { send, fetchImpl, now: NOW })).toEqual(
      {
        sent: 0,
      },
    );
  });
  it("olvida un teléfono que ya no acepta avisos", async () => {
    const { fetchImpl, calls } = firestore({
      ...deposit,
      createdAt: n(NOW + 1),
    });
    const send = vi.fn(async () => {
      throw Object.assign(new Error("gone"), { statusCode: 410 });
    });
    await sendPush(
      bearer,
      { pairId: "g_j", kind: "deposit", id: "d2" },
      { send, fetchImpl: wrap(fetchImpl), now: NOW + 1 },
    );
    expect(calls).toContainEqual([
      "http://firestore.test/v1/projects/demo-guardadito/databases/(default)/documents/pairs/g_j/devices/phone",
      "DELETE",
    ]);
    // d2 is served like d1.
    function wrap(inner) {
      return (url, init) =>
        inner(url.replace("/deposits/d2", "/deposits/d1"), init);
    }
  });
  it("rechaza parejas ajenas y avisos mal formados", async () => {
    const { fetchImpl } = firestore(deposit);
    const send = vi.fn();
    const outsider = `Bearer ${unsigned({ sub: "x" })}`;
    const call = (auth, body) => sendPush(auth, body, { send, fetchImpl });
    await expect(
      call(outsider, { pairId: "g_j", kind: "deposit", id: "d1" }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      call(bearer, { pairId: "../x", kind: "deposit", id: "d1" }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      call(bearer, { pairId: "g_j", kind: "texto", id: "d1" }),
    ).rejects.toMatchObject({ status: 400 });
    delete process.env.VAPID_PRIVATE_KEY;
    await expect(
      call(bearer, { pairId: "g_j", kind: "deposit", id: "d1" }),
    ).rejects.toMatchObject({ status: 503 });
    expect(send).not.toHaveBeenCalled();
  });
});
