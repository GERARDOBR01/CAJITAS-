import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

let env;
// "a" < "j": the pair id is the sorted uids.
const G = "a-gerardo",
  J = "j-jade",
  X = "x-otra";
const PAIR = `${G}_${J}`;
const soon = () => Date.now() + 3600000;
const db = (uid) => env.authenticatedContext(uid).firestore();

async function invite(code = "ABC234", from = G, expiresAt = soon()) {
  await env.withSecurityRulesDisabled((ctx) =>
    setDoc(doc(ctx.firestore(), "invites", code), {
      from,
      fromName: "Gerardo",
      expiresAt,
    }),
  );
}
async function paired() {
  await env.withSecurityRulesDisabled((ctx) =>
    setDoc(doc(ctx.firestore(), "pairs", PAIR), {
      members: [G, J],
      names: { [G]: "Gerardo", [J]: "Jade" },
      invite: "ABC234",
    }),
  );
}
const pairDoc = (invite = "ABC234") => ({
  members: [G, J],
  names: { [G]: "Gerardo", [J]: "Jade" },
  invite,
});
const note = (extra = {}) => ({
  from: G,
  to: J,
  kind: "note",
  fromName: "Gerardo",
  text: "Estoy orgulloso de ti",
  showOn: "open",
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
beforeEach(() => env.clearFirestore());

describe("invitaciones", () => {
  it("se crean a tu nombre, duran poco y no se pueden listar", async () => {
    await assertSucceeds(
      setDoc(doc(db(G), "invites", "ABC234"), {
        from: G,
        fromName: "Gerardo",
        expiresAt: soon(),
      }),
    );
    await assertFails(
      setDoc(doc(db(G), "invites", "ZZZ234"), {
        from: J,
        fromName: "Gerardo",
        expiresAt: soon(),
      }),
    );
    await assertFails(
      setDoc(doc(db(G), "invites", "LARGO2"), {
        from: G,
        fromName: "Gerardo",
        expiresAt: Date.now() + 9 * 86400000,
      }),
    );
    await assertSucceeds(getDoc(doc(db(J), "invites", "ABC234")));
    await assertFails(getDocs(collection(db(J), "invites")));
    await assertFails(deleteDoc(doc(db(J), "invites", "ABC234")));
    await assertSucceeds(deleteDoc(doc(db(G), "invites", "ABC234")));
  });
});

describe("vincular", () => {
  it("con una invitación válida del otro se crea la pareja", async () => {
    await invite();
    await assertSucceeds(setDoc(doc(db(J), "pairs", PAIR), pairDoc()));
  });
  it("sin invitación, con una vencida o con la propia, no", async () => {
    await assertFails(setDoc(doc(db(J), "pairs", PAIR), pairDoc("NOEXIS")));
    await invite("VIEJO2", G, Date.now() - 1000);
    await assertFails(setDoc(doc(db(J), "pairs", PAIR), pairDoc("VIEJO2")));
    await invite("MIA234", J);
    await assertFails(setDoc(doc(db(J), "pairs", PAIR), pairDoc("MIA234")));
  });
  it("nadie se mete en una pareja ajena", async () => {
    await invite();
    await assertFails(setDoc(doc(db(X), "pairs", PAIR), pairDoc()));
    await paired();
    await assertFails(getDoc(doc(db(X), "pairs", PAIR)));
    await assertSucceeds(getDoc(doc(db(J), "pairs", PAIR)));
    await assertSucceeds(
      getDocs(
        query(
          collection(db(J), "pairs"),
          where("members", "array-contains", J),
        ),
      ),
    );
  });
  it("cada quien cambia solo su nombre; cualquiera de los dos desvincula", async () => {
    await paired();
    await assertSucceeds(
      updateDoc(doc(db(J), "pairs", PAIR), { [`names.${J}`]: "Jadecita" }),
    );
    await assertFails(
      updateDoc(doc(db(J), "pairs", PAIR), { [`names.${G}`]: "Otro" }),
    );
    await assertFails(
      updateDoc(doc(db(J), "pairs", PAIR), { members: [J, X] }),
    );
    await assertFails(deleteDoc(doc(db(X), "pairs", PAIR)));
    await assertSucceeds(deleteDoc(doc(db(J), "pairs", PAIR)));
  });
});

describe("sorpresas", () => {
  const gift = (uid, id = "n1") => doc(db(uid), "pairs", PAIR, "gifts", id);
  it("solo la pareja las ve; quien envía las escribe", async () => {
    await paired();
    await assertSucceeds(setDoc(gift(G), note()));
    await assertSucceeds(getDoc(gift(J)));
    await assertFails(getDoc(gift(X)));
    await assertFails(setDoc(gift(X, "n2"), note({ from: X })));
    // No se manda a nombre de otro ni a uno mismo.
    await assertFails(setDoc(gift(J, "n3"), note()));
    await assertFails(setDoc(gift(G, "n4"), note({ to: G })));
    await assertFails(setDoc(gift(G, "n5"), note({ openedAt: 5 })));
    await assertFails(setDoc(gift(G, "n6"), note({ kind: "dinero" })));
    await assertFails(setDoc(gift(G, "n7"), note({ text: "x".repeat(601) })));
  });
  it("Cookie y premios con foto se pueden mandar", async () => {
    await paired();
    await assertSucceeds(
      setDoc(gift(G, `pet-${J}`), {
        from: G,
        to: J,
        kind: "pet",
        fromName: "Gerardo",
        lines: ["¡Muack!"],
        loveText: "¡Te quiero!",
        motto: "",
        createdAt: 1,
      }),
    );
    await assertSucceeds(
      setDoc(gift(G, "r1"), {
        from: G,
        to: J,
        kind: "reward",
        fromName: "Gerardo",
        goalId: "g1",
        goalName: "Viaje",
        threshold: 50,
        title: "Cupón",
        text: "Tú eliges",
        image: "data:image/jpeg;base64," + "a".repeat(1000),
        createdAt: 1,
      }),
    );
  });
  it("quien recibe solo la marca como abierta", async () => {
    await paired();
    await assertSucceeds(setDoc(gift(G), note()));
    await assertSucceeds(updateDoc(gift(J), { openedAt: 10 }));
    await assertFails(updateDoc(gift(J), { text: "cambiado" }));
    await assertFails(deleteDoc(gift(J)));
    await assertSucceeds(updateDoc(gift(G), { text: "Te quiero" }));
    await assertSucceeds(deleteDoc(gift(G)));
  });
  it("Jade ve sus sorpresas pendientes con una consulta", async () => {
    await paired();
    await assertSucceeds(setDoc(gift(G), note()));
    const snap = await assertSucceeds(
      getDocs(
        query(collection(db(J), "pairs", PAIR, "gifts"), where("to", "==", J)),
      ),
    );
    expect(snap.size).toBe(1);
  });
});

describe("avance compartido", () => {
  const summary = (uid, of) => doc(db(uid), "pairs", PAIR, "summaries", of);
  it("cada quien publica el suyo y la pareja lo lee", async () => {
    await paired();
    await assertSucceeds(setDoc(summary(J, J), { goals: [], updatedAt: 1 }));
    await assertFails(setDoc(summary(G, J), { goals: [], updatedAt: 1 }));
    await assertSucceeds(getDoc(summary(G, J)));
    await assertFails(getDoc(summary(X, J)));
  });
});
