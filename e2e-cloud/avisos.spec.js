import { test, expect } from "@playwright/test";
import { pair, signUp } from "./helpers.js";

const contexts = [];
test.afterEach(async () => {
  await Promise.all(contexts.splice(0).map((c) => c.close()));
});

test("Mi pareja ofrece avisos, o explica cómo tenerlos en iPhone", async ({
  browser,
}, info) => {
  const stamp = `${info.project.name}-${Date.now()}`;
  const open = async () => {
    const context = await browser.newContext(info.project.use);
    // Headless Chromium always reports notices as blocked; a phone asks.
    if (info.project.name === "android-chrome")
      await context.addInitScript(() =>
        Object.defineProperty(Notification, "permission", {
          get: () => "default",
        }),
      );
    contexts.push(context);
    return context.newPage();
  };
  const ana = await open(),
    beto = await open();
  await signUp(ana, "Ana", `ana-n-${stamp}@guardadito.test`);
  await signUp(beto, "Beto", `beto-n-${stamp}@guardadito.test`);
  await pair(beto, ana, "Beto", "Ana");
  const panel = ana.locator(".notices");
  await expect(
    panel.getByRole("heading", { name: "🔔 Avisos en este teléfono" }),
  ).toBeVisible();
  if (info.project.name === "iphone-safari") {
    // Safari outside the home screen has no Web Push.
    await expect(panel).toContainText("Agregar a inicio");
  } else {
    await expect(
      panel.getByRole("button", { name: "Activar avisos" }),
    ).toBeVisible();
    await expect(panel).toContainText("cuando Beto te mande una sorpresa");
  }
});
