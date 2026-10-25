import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Turn off formatting rules that conflict with Prettier.
  prettier,
  {
    // Domain logic must stay pure: no React, Next.js or database imports.
    files: ["src/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "react",
            "react-dom",
            "next",
            "next/*",
            "@supabase/*",
            "@/data/*",
            "@/components/*",
            "@/app/*",
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Production build used by the PWA end-to-end tests.
    ".next-e2e/**",
  ]),
]);

export default eslintConfig;
