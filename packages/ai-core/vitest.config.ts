import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts", "src/*-cli.ts"],
      thresholds: { statements: 85, branches: 80, functions: 90, lines: 85 },
    },
  },
});
