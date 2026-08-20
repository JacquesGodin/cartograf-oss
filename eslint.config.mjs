import next from "eslint-config-next";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import reactHooks from "eslint-plugin-react-hooks";

const config = [
  ...next,
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "tsconfig.tsbuildinfo",
      "components/ui/**", // shadcn/ui generated components
      ".claude/**", // worktree scratch areas — not part of the project
    ],
  },
  {
    // Project-wide overrides. The new React 19 rules around refs and effects
    // are strict and flag long-standing patterns in v0-generated code. We
    // surface them as warnings so they show up in editors but don't block
    // CI. They should be tightened to errors during a future cleanup pass.
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/purity": "warn",
      // `any` is sometimes the right tool for parser/scanner code that
      // deals with arbitrary JSON shapes from external sources.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Scripts are plain CommonJS — `require()` is correct there.
    files: ["scripts/**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];

export default config;
