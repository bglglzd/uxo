import i18next from "eslint-plugin-i18next";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      i18next,
    },
    rules: {
      // Catch text in JSX that should be translated
      "i18next/no-literal-string": [
        "error",
        {
          // Check JSX text, string expressions inside JSX, and the
          // user-facing attributes listed below. Other attributes
          // (className, style, id, data-*, event handlers...) are skipped.
          mode: "jsx-only",
          "jsx-attributes": {
            include: ["^(aria-label|title|placeholder|alt|label)$"],
          },
          // Defaults from eslint-plugin-i18next plus settings-store helpers
          // that take setting keys, not user-facing text.
          callees: {
            exclude: [
              "i18n(ext)?",
              "t",
              "require",
              "addEventListener",
              "removeEventListener",
              "postMessage",
              "getElementById",
              "dispatch",
              "commit",
              "includes",
              "indexOf",
              "endsWith",
              "startsWith",
              "isUpdating",
            ],
          },
        },
      ],
    },
  },
];
