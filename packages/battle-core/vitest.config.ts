import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: ["src/index.ts"],
      include: ["src/**/*.ts"],
      provider: "v8",
      thresholds: { branches: 90, statements: 95 },
    },
  },
});
