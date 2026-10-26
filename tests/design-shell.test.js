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
  saveFile: vi.fn(),
}));
// As the public sees it: the owner's tools are off.
vi.mock("../src/features.js", () => ({ ownerTools: false }));
import Settings from "../src/screens/Settings.jsx";
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
const actions = () => ({
  create: vi.fn(),
  move: vi.fn(),
  edit: vi.fn(),
  guardianFor: () => null,
});
const home = (data, extra = {}) =>
  renderToStaticMarkup(
    createElement(Home, {
      data,
      filter: "active",
      onFilter: vi.fn(),
      now: Date.parse("2026-10-16T12:00:00"),
      actions: actions(),
      ...extra,
    }),
  );
const settings = (cloud) =>
  renderToStaticMarkup(
    createElement(Settings, {
      cloud,
      data: initialData(),
      onNavigate: vi.fn(),
    }),
  );

describe("Inicio: una sola acción principal", () => {
  it("con cajitas, el botón grande es Guardar dinero y el pasito lo dice la mascota", () => {
    const html = home(withGoal);
    expect(html).toContain("Guardar dinero");
    expect(html).toContain("Tu pasito:");
    expect(html).toContain("Mi escapadita");
    // Nothing that ticks by the second, no lock, no bank.
    expect(html).not.toMatch(/\d\d:\d\d:\d\d/);
    expect(html).not.toContain("candado");
    expect(html).not.toContain("Nu<");
  });
  it("sin cajitas invita a crear la primera", () => {
    const html = home(initialData());
    expect(html).toContain("Crear mi primera cajita");
    expect(html).not.toContain("Guardar dinero");
  });
  it("una meta sin fecha va sin prisa y sin montos raros", () => {
    const html = home({ ...withGoal, goals: [{ ...goal, unlockDate: null }] });
    expect(html).toContain("Sin prisa");
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("Infinity");
  });
  it("las cumplidas y archivadas esperan detrás de un enlace", () => {
    const done = {
      ...goal,
      id: "d",
      name: "Cumplida",
      entries: [{ id: "e", cents: 100000, at: "2026-10-01T12:00:00" }],
    };
    const html = home({ ...withGoal, goals: [goal, done] });
    expect(html).toContain("Cumplidas (1)");
    expect(html).not.toContain("Ver detalle de Cumplida");
  });
});

describe("Ajustes", () => {
  for (const native of [false, true]) {
    it(
      native ? "la app de Play no ofrece instalar" : "la web ofrece instalar",
      () => {
        state.native = native;
        const html = settings({ configured: true, user: null });
        expect(html.includes("Instalar")).toBe(!native);
        for (const item of [
          "Mi mascota",
          "Recordatorio",
          "Historial",
          "Ahorrar en pareja",
          "Mi cuenta",
          "Respaldo",
          "Ayuda",
        ])
          expect(html).toContain(item);
        // The owner's tools stay out of the public build.
        expect(html).not.toContain("Conexiones");
        expect(html).not.toContain("APK");
      },
    );
  }
  it("sin nube no ofrece cuenta ni pareja", () => {
    state.native = false;
    const html = settings({ configured: false });
    expect(html).not.toContain("Mi cuenta");
    expect(html).not.toContain("Ahorrar en pareja");
  });
});
