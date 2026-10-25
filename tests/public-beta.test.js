import { describe, expect, it } from "vitest";
import { ownerToolsFor } from "../src/features.js";
import {
  clearErrors,
  logError,
  readErrors,
} from "../src/feedback/errorLog.js";
import {
  PROVIDERS,
  initialData,
  moneyPlace,
  validateBackup,
} from "../src/domain.js";

function memory() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

describe("herramientas del dueño", () => {
  it("se apagan en la web publicada y en la app de la tienda", () => {
    expect(ownerToolsFor({ MODE: "pages" })).toBe(false);
    expect(ownerToolsFor({ MODE: "native" })).toBe(false);
  });
  it("siguen al desarrollar, y la variable manda en cualquier modo", () => {
    expect(ownerToolsFor({ MODE: "development" })).toBe(true);
    expect(ownerToolsFor({ MODE: "development", VITE_OWNER_TOOLS: "0" })).toBe(
      false,
    );
    expect(ownerToolsFor({ MODE: "pages", VITE_OWNER_TOOLS: "1" })).toBe(true);
  });
});

describe("registro de errores", () => {
  it("guarda solo el mensaje y se queda con los últimos 20", () => {
    const storage = memory();
    for (let i = 0; i < 25; i++)
      logError(new Error(`falla ${i}`), "prueba", { storage, now: () => i });
    const errors = readErrors(storage);
    expect(errors).toHaveLength(20);
    expect(errors[0]).toEqual({ at: 5, where: "prueba", message: "falla 5" });
    clearErrors(storage);
    expect(readErrors(storage)).toEqual([]);
  });
  it("no truena con un registro dañado ni con mensajes enormes", () => {
    const storage = memory();
    storage.setItem("guardadito:errors", "{no es json");
    expect(readErrors(storage)).toEqual([]);
    logError("x".repeat(5000), "prueba", { storage });
    expect(readErrors(storage)[0].message).toHaveLength(300);
  });
});

describe("dónde guardas tu dinero", () => {
  it("se lee bien en una frase", () => {
    expect(moneyPlace("Nu")).toBe("Nu");
    expect(moneyPlace("Otra")).toBe("tu banco o app");
    expect(moneyPlace("Efectivo")).toBe("tu efectivo o alcancía");
  });
  it("los bancos nuevos pasan la validación del respaldo", () => {
    const data = initialData();
    data.goals = PROVIDERS.map((provider, i) => ({
      id: `g${i}`,
      name: `Meta ${i}`,
      targetCents: 1000,
      unlockDate: null,
      provider,
      icon: "star",
      entries: [],
    }));
    expect(validateBackup(data).goals).toHaveLength(PROVIDERS.length);
  });
});
