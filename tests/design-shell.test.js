import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ native: false }));
vi.mock("../src/platform.js", () => ({
  get isNative() {
    return state.native;
  },
  haptic: vi.fn(),
  openExternal: vi.fn(),
}));
import More from "../src/screens/More.jsx";
import Home from "../src/screens/Home.jsx";
import { initialData } from "../src/domain.js";

const goal = {
  id: "g",
  name: "Mi escapadita",
  provider: "Nu",
  icon: "cloud",
  targetCents: 100000,
  unlockDate: "2099-12-31",
  frequency: 15,
  archived: false,
  entries: [],
};
const withGoal = { ...initialData(), goals: [goal] };

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
          }),
        );
        expect(html.includes('aria-label="Descargar Guardadito"')).toBe(
          !native,
        );
        expect(html).toContain("Tutorial interactivo");
        expect(html).toContain("Un ratito para ti y tus sueños");
        expect(html).not.toContain("Tu siguiente pasito");
        expect(onSave).not.toHaveBeenCalled();
      },
    );
  }
});

describe("el siguiente aporte vive en Inicio", () => {
  const home = (data) =>
    renderToStaticMarkup(
      createElement(Home, {
        data,
        filter: "active",
        onFilter: vi.fn(),
        now: Date.parse("2026-10-16T12:00:00"),
        onCreate: vi.fn(),
        onMove: vi.fn(),
        onEdit: vi.fn(),
        onRecord: vi.fn(),
        onFrequency: vi.fn(),
      }),
    );
  it("aparece junto a la mascota, antes de las cajitas", () => {
    const html = home(withGoal);
    const greeting = html.indexOf("home-greeting"),
      mascot = html.indexOf("home-mascot"),
      step = html.indexOf('aria-label="Tu siguiente pasito"'),
      goals = html.indexOf("home-goals");
    expect(step).toBeGreaterThan(mascot);
    expect(mascot).toBeGreaterThan(greeting);
    expect(goals).toBeGreaterThan(step);
    expect(html).toContain("Registrar mi pasito");
  });
  it("no aparece sin metas por cumplir", () => {
    expect(home(initialData())).not.toContain("Tu siguiente pasito");
    const done = {
      ...withGoal,
      goals: [
        {
          ...goal,
          entries: [{ id: "e", cents: 100000, at: "2026-10-01T12:00:00" }],
        },
      ],
    };
    expect(home(done)).not.toContain("Tu siguiente pasito");
  });
  it("Más ya no lo muestra aunque haya metas", () => {
    const html = renderToStaticMarkup(
      createElement(More, {
        data: withGoal,
        onSave: vi.fn(),
        notify: vi.fn(),
        onNavigate: vi.fn(),
      }),
    );
    expect(html).not.toContain("Tu siguiente pasito");
  });
});
