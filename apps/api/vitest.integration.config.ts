import { resolve } from "node:path";
import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    environment: "node",
    include: ["../../tests/api-integration/**/*.test.ts"],
    setupFiles: ["../../tests/api-integration/setup.ts"],
    globalSetup: ["../../tests/api-integration/global-setup.ts"],
    // setup.ts gives each worker its own database.
    maxWorkers: 6,
    hookTimeout: 60_000,
    testTimeout: 60_000,
    coverage: {
      enabled: false,
    },
  },
  oxc: {
    target: "node18",
  },
  resolve: {
    alias: {
      "@kaneo/email": resolve(
        __dirname,
        "../../tests/api-integration/mocks/email.ts",
      ),
    },
  },
});
