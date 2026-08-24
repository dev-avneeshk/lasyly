import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    globals: true,
    // Exclude network-dependent E2E/integration tests from default `npm run test`.
    // Run them separately: npx vitest run __tests__/e2e/ __tests__/integration/api.test.ts
    exclude: [
      "**/node_modules/**",
      "**/__tests__/e2e/**",
      "**/__tests__/integration/api.test.ts",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
})
