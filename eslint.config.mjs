import globals from "globals";
import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  {
    files: ["**/*.{ts,tsx}"], // Apply to TypeScript files
    ignores: ["node_modules/", "dist/", "coverage/"], // Ignore common directories
    languageOptions: {
      parser: tsParser, // TypeScript parser
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        project: "./tsconfig.json", // Ensure the TypeScript project is referenced
      },
      globals: {
        ...globals.node, // Node.js globals
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin, // Ensure the TypeScript plugin is included
    },
    rules: {
      ...tsPlugin.configs.recommended.rules, // TypeScript recommended rules
      // Ignore unused function parameters that start with _
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" }
      ],
    },
  },
  {
    files: ["**/*.js"], // Apply to JavaScript files
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
    },
    rules: {
      ...js.configs.recommended.rules, // JavaScript recommended rules
      // Ignore unused function parameters that start with _
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" }
      ],
    },
  },
];
