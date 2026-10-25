import { defineConfig } from "@playwright/test";
// The app as the public sees it: same dev server, owner's tools turned off.
export default defineConfig({
  testDir: "./e2e-public",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5175",
    viewport: { width: 390, height: 844 },
    browserName: "chromium",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 5175 --strictPort",
    url: "http://localhost:5175",
    env: { VITE_OWNER_TOOLS: "0" },
    reuseExistingServer: false,
  },
  timeout: 30000,
});
