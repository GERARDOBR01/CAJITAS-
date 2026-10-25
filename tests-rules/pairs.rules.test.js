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
  writeBatch,
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
/** What the app writes to join: the couple, both marks, the code used up. */
function join(
  uid,
  { code = "ABC234", members = [G, J], marks = true, useUp = true } = {},
) {
  const store = db(uid),
    id = members.join("_"),
    batch = writeBatch(store);
  batch.set(doc(store, "pairs", id), {
    members,
    names: Object.fromEntries(members.map((m) => [m, m.slice(2)])),
    invite: code,
  });
  if (marks)
    for (const m of members) batch.set(doc(store, "pairOf", m), { pair: id });
  if (useUp) batch.delete(doc(store, "invites", code));
  return batch.commit();
}
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
    // Each one finds only their own codes (to delete them with the account).
    await assertSucceeds(
      getDocs(query(collection(db(G), "invites"), where("from", "==", G))),
    );
    await assertFails(deleteDoc(doc(db(J), "invites", "ABC234")));
    await assertSucceeds(deleteDoc(doc(db(G), "invites", "ABC234")));
  });
});

describe("vincular", () => {
  it("con una invitación válida del otro se crea la pareja y el código se gasta", async () => {
    await invite();
    await assertSucceeds(join(J));
    let left = true;
    await env.withSecurityRulesDisabled(async (ctx) => {
      left = (await getDoc(doc(ctx.firestore(), "invites", "ABC234"))).exists();
    });
    expect(left).toBe(false);
  });
  it("el código no se puede dejar vivo ni crear la pareja sin las marcas", async () => {
    await invite();
    await assertFails(join(J, { useUp: false }));
    await assertFails(join(J, { marks: false }));
    await assertFails(setDoc(doc(db(J), "pairs", PAIR), pairDoc()));
  });
  it("quien ya tiene pareja no puede tener otra ni repartir códigos", async () => {
    await invite();
    await assertSucceeds(join(J));
    // A code Gerardo made before (or a copy someone kept) does not let a
    // third person in.
    await invite("OTRO23", G);
    await assertFails(join(X, { code: "OTRO23", members: [G, X] }));
    await assertFails(
      setDoc(doc(db(G), "invites", "NUEVO2"), {
        from: G,
        fromName: "Gerardo",
        expiresAt: soon(),
      }),
    );
  });
  it("la marca solo la ponen los de la pareja y se quita al separarse", async () => {
    await paired();
    // Couples made before the mark existed get it from their own app.
    await assertSucceeds(setDoc(doc(db(J), "pairOf", J), { pair: PAIR }));
    await assertFails(setDoc(doc(db(X), "pairOf", X), { pair: PAIR }));
    await assertFails(getDoc(doc(db(G), "pairOf", J)));
    await assertSucceeds(deleteDoc(doc(db(G), "pairOf", J)));
    await assertSucceeds(deleteDoc(doc(db(X), "pairOf", X)));
  });
  it("una pareja de antes de las marcas sigue funcionando", async () => {
    await paired();
    await assertSucceeds(getDoc(doc(db(J), "pairs", PAIR)));
    await assertSucceeds(
      updateDoc(doc(db(J), "pairs", PAIR), { [`names.${J}`]: "Jade" }),
    );
    await assertSucceeds(
      setDoc(doc(db(G), "pairs", PAIR, "summaries", G), {
        goals: [],
        updatedAt: 1,
      }),
    );
  });
  it("sin invitación, con una vencida o con la propia, no", async () => {
    await assertFails(join(J, { code: "NOEXIS" }));
    await invite("VIEJO2", G, Date.now() - 1000);
    await assertFails(join(J, { code: "VIEJO2" }));
    await invite("MIA234", J);
    await assertFails(join(J, { code: "MIA234" }));
  });
  it("nadie se mete en una pareja ajena", async () => {
    await invite();
    await assertFails(join(X));
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
    await assertFails(
      updateDoc(doc(db(J), "pairs", PAIR), { [`names.${J}`]: "x".repeat(41) }),
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
    await assertFails(setDoc(gift(G, "n8"), note({ title: "x".repeat(61) })));
    await assertFails(setDoc(gift(G, "n9"), note({ fromName: 5 })));
    await assertFails(
      setDoc(gift(G, "n10"), note({ lines: Array(9).fill("hola") })),
    );
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
    await assertFails(updateDoc(gift(G), { loveText: "x".repeat(61) }));
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
