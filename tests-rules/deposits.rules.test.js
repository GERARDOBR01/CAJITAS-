import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

let env;
const G = "a-gerardo",
  J = "j-jade",
  X = "x-otra";
const PAIR = `${G}_${J}`;
const db = (uid) => env.authenticatedContext(uid).firestore();
const payoutRef = (uid, owner = G) =>
  doc(db(uid), "pairs", PAIR, "payout", owner);
const depRef = (uid, id = "d1") => doc(db(uid), "pairs", PAIR, "deposits", id);
const payout = (extra = {}) => ({
  clabe: "002010077777777771",
  holder: "Gerardo B",
  bank: "Mercado Pago",
  updatedAt: 1,
  ...extra,
});
const dep = (extra = {}) => ({
  from: J,
  to: G,
  goalId: "viaje",
  goalName: "Viaje",
  cents: 20000,
  method: "spei",
  status: "pending",
  note: "",
  createdAt: 1,
  ...extra,
});
const asAdmin = (fn) =>
  env.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()));

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

describe("depósitos a través del guardián", () => {
  it("solo la pareja ve la CLABE y solo su dueño la escribe", async () => {
    await assertSucceeds(setDoc(payoutRef(G), payout()));
    await assertSucceeds(getDoc(payoutRef(J)));
    await assertFails(getDoc(payoutRef(X)));
    await assertFails(
      setDoc(payoutRef(J), payout({ clabe: "000000000000000000" })),
    );
    await assertFails(deleteDoc(payoutRef(J)));
    await assertSucceeds(deleteDoc(payoutRef(G)));
  });
  it("la CLABE tiene 18 números", async () => {
    await assertFails(setDoc(payoutRef(G), payout({ clabe: "12345" })));
    await assertFails(
      setDoc(payoutRef(G), payout({ clabe: "00201007777777777a" })),
    );
    await assertFails(setDoc(payoutRef(G), payout({ extra: true })));
  });
  it("solo se avisa un depósito a quien guarda y siempre empieza pendiente", async () => {
    await assertFails(setDoc(depRef(J), dep()));
    await assertSucceeds(setDoc(payoutRef(G), payout()));
    await assertSucceeds(setDoc(depRef(J), dep()));
    await assertFails(setDoc(depRef(J, "d2"), dep({ status: "confirmed" })));
    await assertFails(setDoc(depRef(G, "d3"), dep()));
    await assertFails(setDoc(depRef(J, "d4"), dep({ to: X })));
    await assertFails(setDoc(depRef(J, "d5"), dep({ cents: 0 })));
    await assertFails(setDoc(depRef(J, "d6"), dep({ method: "tarjeta" })));
    // Nadie le avisa a Jade: ella no guarda dinero.
    await assertFails(setDoc(depRef(G, "d7"), dep({ from: G, to: J })));
    await assertFails(getDoc(depRef(X)));
  });
  it("solo el guardián confirma, una sola vez", async () => {
    await assertSucceeds(setDoc(payoutRef(G), payout()));
    await assertSucceeds(setDoc(depRef(J), dep()));
    await assertFails(
      updateDoc(depRef(J), { status: "confirmed", decidedAt: 2 }),
    );
    await assertFails(
      updateDoc(depRef(G), { status: "confirmed", decidedAt: 2, cents: 99999 }),
    );
    await assertSucceeds(
      updateDoc(depRef(G), { status: "confirmed", decidedAt: 2 }),
    );
    await assertFails(
      updateDoc(depRef(G), { status: "rejected", decidedAt: 3 }),
    );
  });
  it("quien deposita lo marca como registrado y luego puede quitarlo", async () => {
    await asAdmin((db) =>
      setDoc(
        doc(db, "pairs", PAIR, "deposits", "d1"),
        dep({ status: "confirmed", decidedAt: 2 }),
      ),
    );
    await assertFails(deleteDoc(depRef(J)));
    await assertFails(updateDoc(depRef(G), { appliedAt: 3 }));
    await assertSucceeds(updateDoc(depRef(J), { appliedAt: 3 }));
    await assertSucceeds(deleteDoc(depRef(J)));
  });
  it("un aviso pendiente o rechazado se cancela", async () => {
    await asAdmin((db) =>
      Promise.all([
        setDoc(doc(db, "pairs", PAIR, "deposits", "p"), dep()),
        setDoc(
          doc(db, "pairs", PAIR, "deposits", "r"),
          dep({ status: "rejected", decidedAt: 2 }),
        ),
      ]),
    );
    await assertFails(deleteDoc(depRef(G, "p")));
    await assertFails(updateDoc(depRef(J, "r"), { appliedAt: 3 }));
    await assertSucceeds(deleteDoc(depRef(J, "p")));
    await assertSucceeds(deleteDoc(depRef(J, "r")));
  });
});
