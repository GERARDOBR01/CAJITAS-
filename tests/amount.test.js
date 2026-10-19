import { describe, expect, it } from "vitest";
import { cleanAmount, nextAmount } from "../src/amount.js";

const type = (...keys) =>
  keys.reduce((value, key) => nextAmount(value, key), "");

describe("teclado de montos", () => {
  it("arma cantidades enteras", () => {
    expect(type("5", "0", "0")).toBe("500");
  });
  it("no empieza con ceros de sobra", () => {
    expect(type("0", "0", "7")).toBe("7");
  });
  it("acepta un solo punto y dos decimales", () => {
    expect(type(".", "5")).toBe("0.5");
    expect(type("1", ".", "2", ".", "5")).toBe("1.25");
    expect(type("1", ".", "2", "5", "9")).toBe("1.25");
  });
  it("borra de uno en uno y no falla con el campo vacío", () => {
    expect(type("1", "2", "back")).toBe("1");
    expect(type("back")).toBe("");
  });
  it("limita las cifras para no desbordar", () => {
    expect(type(..."123456789".split("")).length).toBe(8);
  });
  it("limpia lo que se escribe con el teclado físico", () => {
    expect(cleanAmount("$1,250.567")).toBe("1250.56");
    expect(cleanAmount("007")).toBe("7");
    expect(cleanAmount("1.2.3")).toBe("1.23");
    expect(cleanAmount("abc")).toBe("");
  });
});
