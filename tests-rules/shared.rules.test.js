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
const goalRef = (uid, id = "viaje") => doc(db(uid), "pairs", PAIR, "goals", id);
const entryRef = (uid, id = "e1") => doc(db(uid), "pairs", PAIR, "entries", id);
const goal = (extra = {}) => ({
  name: "Viaje",
  targetCents: 2000000,
  unlockDate: "",
  icon: "star",
  split: { [G]: 60, [J]: 40 },
  createdBy: G,
  createdAt: 1,
  archived: false,
  ...extra,
});
const entry = (by, extra = {}) => ({
  goalId: "viaje",
  by,
  cents: 30000,
  at: "2026-10-18T12:00:00.000Z",
  note: "",
  createdAt: 1,
  ...extra,
});

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

describe("cajitas en pareja", () => {
  it("cualquiera de los dos la crea y la edita; nadie la borra", async () => {
    await assertSucceeds(setDoc(goalRef(G), goal()));
    await assertSucceeds(updateDoc(goalRef(J), { name: "Viaje a Cancún" }));
    await assertSucceeds(updateDoc(goalRef(J), { archived: true }));
    await assertFails(deleteDoc(goalRef(G)));
    await assertFails(getDoc(goalRef(X)));
    await assertFails(setDoc(goalRef(X, "otra"), goal()));
  });
  it("la forma tiene que ser válida", async () => {
    await assertFails(setDoc(goalRef(G), goal({ targetCents: 0 })));
    await assertFails(setDoc(goalRef(G), goal({ split: { [X]: 100 } })));
    await assertFails(setDoc(goalRef(G), goal({ dinero: "real" })));
  });
  it("cada quien registra y corrige solo sus aportes", async () => {
    await assertSucceeds(setDoc(goalRef(G), goal()));
    await assertSucceeds(setDoc(entryRef(J), entry(J)));
    await assertSucceeds(getDoc(entryRef(G)));
    await assertFails(setDoc(entryRef(G, "e2"), entry(J)));
    await assertFails(updateDoc(entryRef(G), { cents: 1 }));
    await assertFails(deleteDoc(entryRef(G)));
    await assertSucceeds(updateDoc(entryRef(J), { cents: 25000 }));
    await assertSucceeds(deleteDoc(entryRef(J)));
    await assertFails(getDoc(entryRef(X)));
  });
  it("no hay aportes de cero ni para cajitas que no existen", async () => {
    await assertSucceeds(setDoc(goalRef(G), goal()));
    await assertFails(setDoc(entryRef(J), entry(J, { cents: 0 })));
    await assertFails(setDoc(entryRef(J), entry(J, { goalId: "nada" })));
    await assertSucceeds(setDoc(entryRef(J, "r1"), entry(J, { cents: -100 })));
  });
});
