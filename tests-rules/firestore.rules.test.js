import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";

let env;
const state = (db, uid) => doc(db, "users", uid, "state", "main");
const valid = { raw: '{"version":2}', savedAt: 1, version: 2 };

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
beforeEach(() => env.clearFirestore());

describe("las cajitas de cada quien", () => {
  it("la dueña lee, escribe y borra su copia", async () => {
    const db = env.authenticatedContext("jade").firestore();
    await assertSucceeds(setDoc(state(db, "jade"), valid));
    await assertSucceeds(getDoc(state(db, "jade")));
    await assertSucceeds(deleteDoc(state(db, "jade")));
  });
  it("otra persona no las lee ni las cambia", async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(state(ctx.firestore(), "jade"), valid),
    );
    const db = env.authenticatedContext("otra").firestore();
    await assertFails(getDoc(state(db, "jade")));
    await assertFails(setDoc(state(db, "jade"), valid));
    await assertFails(deleteDoc(state(db, "jade")));
  });
  it("sin sesión no se ve nada", async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(state(db, "jade")));
  });
  it("solo acepta la forma esperada", async () => {
    const db = env.authenticatedContext("jade").firestore();
    await assertFails(setDoc(state(db, "jade"), { ...valid, extra: true }));
    await assertFails(setDoc(state(db, "jade"), { ...valid, raw: 5 }));
    await assertFails(
      setDoc(state(db, "jade"), { ...valid, raw: "x".repeat(1000001) }),
    );
  });
  it("nada fuera de su copia", async () => {
    const db = env.authenticatedContext("jade").firestore();
    await assertFails(setDoc(doc(db, "users", "jade", "otra", "x"), valid));
  });
});
