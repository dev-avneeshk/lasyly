import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // React 19 rule that flags useEffect→fetch→setState patterns.
      // These are valid and correct in our codebase; the recommended
      // alternative (use() / RSC) requires architectural changes.
      "react-hooks/set-state-in-effect": "off",
      // React 19 compiler rules — these flag patterns like Date.now()
      // in render and variable hoisting in hooks. They're valid code
      // that works correctly; fixing requires React Compiler adoption.
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      // Allow explicit any in this codebase — we use it for Supabase
      // responses and third-party API data where types aren't available.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
]);

export default eslintConfig;
