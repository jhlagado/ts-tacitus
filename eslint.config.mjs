import globals from 'globals';
import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
// Add jest rules for test files

/**  @type {import('eslint').Linter.FlatConfig[]} */

export default [
  {
    files: ['**/*.{ts,tsx}'], // Apply to TypeScript files
    ignores: ['node_modules/', 'dist/', 'coverage/'], // Ignore common directories
    languageOptions: {
      parser: tsParser, // TypeScript parser
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json', // Ensure the TypeScript project is referenced
      },
      globals: {
        ...globals.node, // Node.js globals
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin, // Ensure the TypeScript plugin is included
    },
    rules: {
      ...tsPlugin.configs.recommended.rules, // TypeScript recommended rules
      // Configure exactly like the JavaScript rule
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      // Enforce blank lines between functions
      'padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: 'function', next: 'function' },
        { blankLine: 'always', prev: 'function', next: '*' },
        { blankLine: 'always', prev: '*', next: 'function' },
        { blankLine: 'always', prev: 'block-like', next: 'block-like' },
      ],
    },
  },
  {
    files: ['**/*.js'], // Apply to JavaScript files
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
    },
    rules: {
      ...js.configs.recommended.rules, // JavaScript recommended rules
      // Ignore unused function parameters that start with _
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
