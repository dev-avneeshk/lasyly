import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    globals: true,
    // Vitest defaults to 5s, which is too tight for this repo. The arena tests
    // are Monte-Carlo: `difficulty.test.ts` plays thousands of simulated games to
    // assert the CPU ladder is monotonic, and it lands at ~5.5s — so it failed on
    // the timeout while its assertions were fine. `arena/server.test.ts` sat just
    // under the line and failed or passed depending on machine load, which is
    // worse, because a red suite you learn to ignore stops being a signal.
    //
    // 30s is generous enough that a timeout now means something is actually
    // wrong (a hang, a deadlock) rather than "this machine was busy".
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Exclude network-dependent E2E/integration tests from default `npm run test`.
    // Run them separately: npx vitest run __tests__/e2e/ __tests__/integration/api.test.ts
    exclude: [
      "**/node_modules/**",
      "**/__tests__/e2e/**",
      "**/__tests__/integration/api.test.ts",
      // On-demand CPU-vs-CPU tournament harness (long-running).
      //
      // NOTE: `exclude` wins even when you name the file on the command line, so
      // the old comment here — "run explicitly: npx vitest run
      // __tests__/arena/cpu-vs-cpu.sim.test.ts" — did not work; it exits with
      // "No test files found". Neither does `--exclude ""` (which is what the
      // test:all script passes). To run it, comment this line out.
      "**/*.sim.test.ts",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
})
