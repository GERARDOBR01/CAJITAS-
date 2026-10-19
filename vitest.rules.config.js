import { defineConfig } from "vitest/config";

// Run inside the Firestore emulator: `npm run test:rules`. Files share one
// emulator and clear it between tests, so they run one after another.
export default defineConfig({
  test: {
    include: ["tests-rules/**/*.test.js"],
    testTimeout: 20000,
    fileParallelism: false,
  },
});
