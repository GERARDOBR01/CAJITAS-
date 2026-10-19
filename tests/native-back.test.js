import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const app = vi.hoisted(() => ({
  listener: null,
  exitApp: vi.fn(async () => {}),
  addListener: vi.fn(async (name, fn) => {
    app.listener = fn;
  }),
}));
vi.mock("@capacitor/app", () => ({
  App: { addListener: app.addListener, exitApp: app.exitApp },
}));
import { listenForBack } from "../src/navigation/native.js";

let target, dialog, history;
beforeEach(async () => {
  app.exitApp.mockClear();
  target = new EventTarget();
  dialog = null;
  history = { back: vi.fn() };
  vi.stubGlobal("window", target);
  vi.stubGlobal("history", history);
  vi.stubGlobal("document", { querySelector: () => dialog });
  await listenForBack();
});
afterEach(() => vi.unstubAllGlobals());

const press = (canGoBack = false) => app.listener({ canGoBack });
// A screen that is not home answers the event, as useNavigation does.
const screenAnswers = () =>
  target.addEventListener("guardadito:back", (event) => event.preventDefault());

describe("botón atrás de Android", () => {
  it("cierra primero el diálogo abierto", async () => {
    dialog = new EventTarget();
    const cancel = vi.fn();
    dialog.addEventListener("cancel", cancel);
    await press();
    expect(cancel).toHaveBeenCalled();
    expect(app.exitApp).not.toHaveBeenCalled();
  });

  it("retrocede en el historial si hay a dónde", async () => {
    await press(true);
    expect(history.back).toHaveBeenCalled();
    expect(app.exitApp).not.toHaveBeenCalled();
  });

  it("fuera de Mis cajitas, la pantalla vuelve a casa y la app sigue abierta", async () => {
    screenAnswers();
    await press();
    expect(app.exitApp).not.toHaveBeenCalled();
  });

  it("en Mis cajitas, sin nadie que responda, cierra la app", async () => {
    await press();
    expect(app.exitApp).toHaveBeenCalledTimes(1);
  });
});
