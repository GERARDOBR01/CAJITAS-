import { defineConfig } from "vitest/config";

// Run inside the Firestore emulator: `npm run test:rules`.
export default defineConfig({
  test: { include: ["tests-rules/**/*.test.js"], testTimeout: 20000 },
});
