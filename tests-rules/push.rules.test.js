import { readFileSync } from "node:fs";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
import { sendPush } from "../server/push.js";

let env;
const G = "a-gerardo",
  J = "j-jade",
  X = "x-otra";
const PAIR = `${G}_${J}`;
const db = (uid) => env.authenticatedContext(uid).firestore();
const deviceRef = (uid, id = "phone-g") =>
  doc(db(uid), "pairs", PAIR, "devices", id);
const device = (uid, extra = {}) => ({
  uid,
  endpoint: "https://web.push.apple.com/QGxhbmRpbmc",
  p256dh:
    "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
  auth: "tBHItJI5svbpez7KI4CCXg",
  updatedAt: 1,
  ...extra,
});
// The same unsigned session the emulator gives the app.
const bearer = (uid) =>
  "Bearer " +
  [
    { alg: "none", typ: "JWT" },
    {
      sub: uid,
      user_id: uid,
      aud: "demo-guardadito",
      iss: "https://securetoken.google.com/demo-guardadito",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      firebase: { sign_in_provider: "password", identities: {} },
    },
  ]
    .map((part) => Buffer.from(JSON.stringify(part)).toString("base64url"))
    .join(".") +
  ".";

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-guardadito",
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});
afterAll(() => env?.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled((ctx) =>
    setDoc(doc(ctx.firestore(), "pairs", PAIR), {
      members: [G, J],
      names: { [G]: "Gerardo", [J]: "Jade" },
      invite: "ABC234",
    }),
  );
});

describe("teléfonos que reciben avisos", () => {
  it("cada quien registra solo los suyos; la pareja los ve", async () => {
    await assertSucceeds(setDoc(deviceRef(G), device(G)));
    await assertSucceeds(getDoc(deviceRef(J)));
    await assertFails(getDoc(deviceRef(X)));
    await assertFails(setDoc(deviceRef(J, "phone-j"), device(G)));
    await assertFails(setDoc(deviceRef(J), device(J)));
    await assertFails(setDoc(deviceRef(X, "phone-x"), device(X)));
  });
  it("solo direcciones https y sin campos de más", async () => {
    await assertFails(
      setDoc(deviceRef(G), device(G, { endpoint: "http://evil.test/x" })),
    );
    await assertFails(setDoc(deviceRef(G), device(G, { extra: 1 })));
  });
  it("la pareja puede quitar un teléfono que ya no responde", async () => {
    await assertSucceeds(setDoc(deviceRef(G), device(G)));
    await assertFails(deleteDoc(deviceRef(X)));
    await assertSucceeds(deleteDoc(deviceRef(J)));
  });
});

describe("el servidor lee con la sesión de quien avisa", () => {
  it("avisa al guardián de un depósito real y nada a desconocidos", async () => {
    process.env.VAPID_PUBLIC_KEY = "pub";
    process.env.VAPID_PRIVATE_KEY = "priv";
    await assertSucceeds(setDoc(deviceRef(G), device(G)));
    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), "pairs", PAIR, "deposits", "d1"), {
        from: J,
        to: G,
        goalId: "viaje",
        goalName: "Viaje",
        cents: 20000,
        method: "spei",
        status: "pending",
        createdAt: Date.now(),
      }),
    );
    const send = vi.fn(async () => {});
    const body = { pairId: PAIR, kind: "deposit", id: "d1" };
    await expect(sendPush(bearer(X), body, { send })).rejects.toMatchObject({
      status: 403,
    });
    expect(await sendPush(bearer(J), body, { send })).toEqual({ sent: 1 });
    expect(send.mock.calls[0][0].endpoint).toBe(device(G).endpoint);
    expect(JSON.parse(send.mock.calls[0][1]).body).toBe(
      "Jade dice que te mandó $200.00 para Viaje. ¿Te llegó?",
    );
  });
});
