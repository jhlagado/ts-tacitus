// ESLint configuration for both JavaScript and TypeScript files
import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import globals from 'globals';

/** @type {import('eslint').Linter.FlatConfig[]} */
const config = [
  // Shared ignores for all configurations
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**', '**/*.js.map', '**/*.d.ts'],
  },

  // TypeScript files configuration
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      // Base ESLint rules
      ...js.configs.recommended.rules,

      // TypeScript-specific rules
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-inferrable-types': 'warn',

      // Relaxed rules for test files
      'no-console': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',

      // Turn off base ESLint rules that are covered by TypeScript
      'no-unused-vars': 'off', // Use @typescript-eslint version instead
      'no-undef': 'off', // TypeScript handles this
    },
  },

  // JavaScript files with relaxed rules
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': 'warn',
      'no-console': 'off',
    },
  },

  // ES modules (.mjs files)
  {
    files: ['**/*.mjs', 'eslint.config.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': 'warn',
      'no-console': 'off',
    },
  },
];

export default config;
