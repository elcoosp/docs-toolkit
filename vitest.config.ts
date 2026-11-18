import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit-linkedom",
          environment: "node",
          include: ["tests/**/*.linkedom.test.ts"],
        },
      },
      {
        test: {
          name: "browser-dom",
          include: ["tests/**/*.browser.test.ts"],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: "chromium" }],
          },
        },
      },
      {
        test: {
          name: "e2e-real-site",
          environment: "node",
          testTimeout: 30000,
          include: ["tests/**/*.e2e.test.ts"],
        },
      },
    ],
  },
});
