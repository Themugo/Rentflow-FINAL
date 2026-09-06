import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "node_modules",
      "batch2",
      "batch3",
      "final-batch",
      "final-ui",
      "final100",
      "fixes",
      "landing",
      "mega",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      // Phase 12 typecheck exemptions use file-level @ts-nocheck (see docs/audits/TYPECHECK_EXEMPTIONS.txt)
      "@typescript-eslint/ban-ts-comment": ["error", { "ts-nocheck": false, "ts-ignore": true, "ts-expect-error": "allow-with-description" }],
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-fallthrough": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
      // Prevent direct console usage - use errorLogger instead
      "no-console": ["error", { allow: ["warn", "error", "debug"] }],
      // Allow setState in useEffect for controlled form initialization
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["supabase/functions/**/*.ts"],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
