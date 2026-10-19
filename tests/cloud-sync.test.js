import { describe, it, expect } from "vitest";
import { initialData, validateBackup } from "../src/domain.js";
import {
  authMessage,
  firstSync,
  fromCloud,
  hasContent,
  reconcile,
  toCloud,
} from "../src/cloud/sync.js";

const goal = (id, cents = 0) => ({
  id,
  name: `Meta ${id}`,
  provider: "Nu",
  icon: "star",
  targetCents: 100000,
  unlockDate: "",
  entries: cents
    ? [
        {
          id: `e-${id}`,
          cents,
          at: "2026-10-18T12:00:00.000Z",
          source: "manual",
        },
      ]
    : [],
});
const journal = (goals = [], savedAt = 0) => ({
  ...initialData(),
  goals,
  savedAt,
});

describe("copia en la cuenta", () => {
  it("va y vuelve igual, con su marca de tiempo", () => {
    const data = journal([goal("a", 5000)], 42);
    const doc = toCloud(data);
    expect(doc.savedAt).toBe(42);
    expect(typeof doc.raw).toBe("string");
    expect(fromCloud(doc)).toEqual(validateBackup(data));
  });
  it("rechaza una copia dañada en vez de borrar las cajitas", () => {
    expect(() => fromCloud({ raw: "{" })).toThrow();
    expect(() => fromCloud({ raw: JSON.stringify({ hola: 1 }) })).toThrow();
    expect(() => fromCloud(null)).toThrow();
  });
  it("una visita sin cajitas también cuenta como contenido", () => {
    expect(hasContent(journal())).toBe(false);
    expect(hasContent({ ...journal(), checkins: ["2026-10-18"] })).toBe(true);
  });
});

describe("entre dispositivos gana el cambio más reciente", () => {
  it("compara savedAt", () => {
    expect(reconcile(journal([], 1), journal([], 2))).toBe("pull");
    expect(reconcile(journal([], 3), journal([], 2))).toBe("push");
    expect(reconcile(journal([], 2), journal([], 2))).toBe("none");
  });
});

describe("la primera vez que se juntan cuenta y teléfono", () => {
  const uid = "jade";
  it("cuenta nueva y teléfono vacío: se crea la copia sin preguntar", () => {
    expect(firstSync({ local: journal(), remote: null, uid })).toBe("push");
  });
  it("cuenta nueva y teléfono con cajitas: pregunta antes de subir", () => {
    expect(firstSync({ local: journal([goal("a")]), remote: null, uid })).toBe(
      "ask-upload",
    );
  });
  it("teléfono vacío: trae las cajitas de la cuenta", () => {
    expect(
      firstSync({ local: journal(), remote: journal([goal("a")], 5), uid }),
    ).toBe("pull");
  });
  it("cajitas distintas en los dos lados: pregunta cuáles usar", () => {
    expect(
      firstSync({
        local: journal([goal("a")], 9),
        remote: journal([goal("b")], 5),
        uid,
      }),
    ).toBe("ask-choose");
  });
  it("mismo teléfono de la misma cuenta: solo sincroniza", () => {
    expect(
      firstSync({
        local: journal([goal("a", 100)], 9),
        remote: journal([goal("b")], 5),
        linkedUid: uid,
        uid,
      }),
    ).toBe("push");
  });
  it("teléfono de otra cuenta: nunca mezcla sin preguntar", () => {
    expect(
      firstSync({
        local: journal([goal("a")], 9),
        remote: journal([goal("b")], 5),
        linkedUid: "gerardo",
        uid,
      }),
    ).toBe("ask-choose");
  });
  it("las mismas cajitas en los dos lados: no pregunta", () => {
    expect(
      firstSync({
        local: journal([goal("a")], 3),
        remote: journal([goal("a")], 5),
        uid,
      }),
    ).toBe("pull");
  });
});

it("traduce los errores de la cuenta a mensajes claros", () => {
  expect(authMessage({ code: "auth/invalid-credential" })).toMatch(
    /no coinciden/,
  );
  expect(authMessage({ code: "auth/otro", message: "x" })).toBe("x");
});
