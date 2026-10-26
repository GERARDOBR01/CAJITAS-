import { describe, expect, it } from "vitest";
import { initialData } from "../src/domain.js";
import { markWelcomed, needsWelcome } from "../src/components/Welcome.jsx";

function memory() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
  };
}
const goal = {
  id: "g",
  name: "Viaje",
  targetCents: 100,
  unlockDate: null,
  provider: "Nu",
  icon: "star",
  entries: [],
};

describe("bienvenida", () => {
  it("saluda una sola vez a quien llega con el teléfono vacío", () => {
    const storage = memory();
    expect(needsWelcome(initialData(), { storage, automated: false })).toBe(
      true,
    );
    markWelcomed(storage);
    expect(needsWelcome(initialData(), { storage, automated: false })).toBe(
      false,
    );
  });
  it("no interrumpe a quien ya tiene cajitas o visitas", () => {
    const storage = memory();
    const withGoal = { ...initialData(), goals: [goal] };
    expect(needsWelcome(withGoal, { storage, automated: false })).toBe(false);
    const visited = { ...initialData(), checkins: ["2026-10-20"] };
    expect(needsWelcome(visited, { storage, automated: false })).toBe(false);
  });
  it("las pruebas automáticas la piden con ?bienvenida=1", () => {
    const storage = memory();
    expect(needsWelcome(initialData(), { storage, automated: true })).toBe(
      false,
    );
    expect(
      needsWelcome(initialData(), {
        storage,
        automated: true,
        search: "?bienvenida=1",
      }),
    ).toBe(true);
  });
});
