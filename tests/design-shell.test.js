import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ native: false }));
vi.mock("../src/platform.js", () => ({
  get isNative() {
    return state.native;
  },
  haptic: vi.fn(),
}));
import More from "../src/screens/More.jsx";
import { initialData } from "../src/domain.js";

describe("descarga en Más según la plataforma", () => {
  for (const native of [false, true]) {
    it(
      native
        ? "la app nativa conserva las herramientas y omite el banner Android"
        : "la web ofrece la descarga Android dentro de Más",
      () => {
        state.native = native;
        const onSave = vi.fn();
        const html = renderToStaticMarkup(
          createElement(More, {
            data: initialData(),
            onSave,
            notify: vi.fn(),
            onNavigate: vi.fn(),
            onRecord: vi.fn(),
            onEdit: vi.fn(),
          }),
        );
        expect(html.includes('aria-label="Descargar Guardadito"')).toBe(
          !native,
        );
        expect(html).toContain("Tutorial interactivo");
        expect(html).toContain("Un ratito para ti y tus sueños");
        expect(onSave).not.toHaveBeenCalled();
      },
    );
  }
});
