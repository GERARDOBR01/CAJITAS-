import { defineConfig, devices } from "@playwright/test";

// Accounts against the local Firebase emulators: `npm run test:e2e:cloud`.
export default defineConfig({
  testDir: "./e2e-cloud",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://localhost:5174", trace: "retain-on-failure" },
  projects: [
    {
      name: "android-chrome",
      use: { ...devices["Pixel 7"], browserName: "chromium" },
    },
    { name: "iphone-safari", use: { ...devices["iPhone 15"] } },
  ],
  webServer: {
    command: "npx vite --port 5174 --strictPort",
    url: "http://localhost:5174",
    env: { VITE_FIREBASE_EMULATOR: "1" },
    reuseExistingServer: false,
  },
  timeout: 120000,
});
