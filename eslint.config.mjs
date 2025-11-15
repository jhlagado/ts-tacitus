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

  // TypeScript files configuration (non-test files with type-aware linting)
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['**/*.test.ts', '**/*.spec.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname || process.cwd(),
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

      // ===== STRICT TYPE SAFETY =====
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-implied-eval': 'error',
      '@typescript-eslint/prefer-includes': 'error',
      '@typescript-eslint/prefer-string-starts-ends-with': 'error',
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-inferrable-types': 'error', // Enforce explicit types
      '@typescript-eslint/no-unnecessary-type-constraint': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'error',
      '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'error',
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/consistent-indexed-object-style': ['error', 'record'],
      '@typescript-eslint/array-type': ['error', { default: 'array' }],
      '@typescript-eslint/prefer-for-of': 'error',
      '@typescript-eslint/prefer-function-type': 'error',
      '@typescript-eslint/prefer-namespace-keyword': 'error',
      '@typescript-eslint/prefer-literal-enum-member': 'error',
      '@typescript-eslint/prefer-as-const': 'error',
      '@typescript-eslint/no-confusing-void-expression': 'error',
      '@typescript-eslint/no-meaningless-void-operator': 'error',
      '@typescript-eslint/no-redundant-type-constituents': 'error',
      '@typescript-eslint/no-useless-empty-export': 'error',
      '@typescript-eslint/no-var-requires': 'error', // Ban require() in TypeScript
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': true,
          'ts-nocheck': true,
          'ts-check': false,
        },
      ],

      // ===== CODE QUALITY =====
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          args: 'all',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/no-empty-function': 'error',
      '@typescript-eslint/no-empty-interface': 'error',
      '@typescript-eslint/no-extraneous-class': 'error',
      '@typescript-eslint/no-invalid-void-type': 'error',
      '@typescript-eslint/no-this-alias': 'error',
      '@typescript-eslint/no-unused-expressions': 'error',
      '@typescript-eslint/no-use-before-define': [
        'error',
        {
          functions: false, // Don't check functions (they are hoisted, so allow use before definition)
          classes: false, // Don't check classes (they are hoisted, so allow use before definition)
          variables: true, // Still enforce for variables
          typedefs: true, // Still enforce for type definitions
        },
      ],
      '@typescript-eslint/triple-slash-reference': 'error',

      // ===== BEST PRACTICES =====
      'no-console': ['error', { allow: ['warn', 'error'] }], // Only allow console.warn/error
      'no-debugger': 'error',
      'no-alert': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-wrappers': 'error',
      'no-throw-literal': 'error',
      'no-return-await': 'error',
      'prefer-promise-reject-errors': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-template': 'error',
      'prefer-spread': 'error',
      'prefer-rest-params': 'error',
      'prefer-destructuring': [
        'error',
        {
          array: true,
          object: true,
        },
      ],
      'no-param-reassign': 'error',
      'no-return-assign': 'error',
      'no-sequences': 'error',
      'no-unneeded-ternary': 'error',
      'no-useless-call': 'error',
      'no-useless-computed-key': 'error',
      'no-useless-concat': 'error',
      'no-useless-constructor': 'error',
      'no-useless-rename': 'error',
      'no-useless-return': 'error',
      'object-shorthand': 'error',
      'prefer-exponentiation-operator': 'error',
      'prefer-numeric-literals': 'error',
      'prefer-object-spread': 'error',
      yoda: 'error',

      // ===== IMPORT/EXPORT RULES =====
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/dist/**', '**/coverage/**'],
              message: 'Do not import from build artifacts',
            },
            {
              group: ['../lang/*'],
              message: 'Core/Ops must not import from Lang.',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'CallExpression[callee.name="require"]',
          message: 'require() is not allowed in TypeScript. Use ES6 import statements instead.',
        },
        {
          selector: 'MemberExpression[object.name="module"][property.name="exports"]',
          message: 'module.exports is not allowed. Use ES6 export statements instead.',
        },
        {
          selector: 'AssignmentExpression[left.object.name="exports"]',
          message: 'exports.foo = ... is not allowed. Use ES6 export statements instead.',
        },
      ],

      // ===== STYLING & CONSISTENCY =====
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      curly: ['error', 'all'],
      'brace-style': ['error', '1tbs', { allowSingleLine: false }],
      'comma-dangle': ['error', 'always-multiline'],
      'comma-spacing': 'error',
      'comma-style': 'error',
      'computed-property-spacing': 'error',
      'func-call-spacing': 'error',
      'key-spacing': 'error',
      'keyword-spacing': 'error',
      'no-multi-spaces': 'error',
      'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0 }],
      'no-trailing-spaces': 'error',
      'object-curly-spacing': ['error', 'always'],
      semi: ['error', 'always'],
      'semi-spacing': 'error',
      'space-before-blocks': 'error',
      'space-before-function-paren': [
        'error',
        {
          anonymous: 'always',
          named: 'never',
          asyncArrow: 'always',
        },
      ],
      'space-in-parens': 'error',
      'space-infix-ops': 'error',
      'space-unary-ops': 'error',
      'spaced-comment': [
        'error',
        'always',
        {
          exceptions: ['-', '+'],
          markers: ['/'],
        },
      ],

      // Turn off base ESLint rules that are covered by TypeScript
      'no-unused-vars': 'off', // Use @typescript-eslint version instead
      'no-unused-args': 'off', // Handled by @typescript-eslint/no-unused-vars
      'no-undef': 'off', // TypeScript handles this
      'no-redeclare': 'off', // TypeScript handles this
      'no-duplicate-imports': 'off', // Disabled: conflicts with consistent-type-imports. TypeScript catches real duplicates.
    },
  },

  // Exception: VM owns the compiler state, so it's allowed to import it
  {
    files: ['src/core/vm.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/dist/**', '**/coverage/**'],
              message: 'Do not import from build artifacts',
            },
            // Note: ../lang/compiler is allowed for VM since it owns the compiler
          ],
        },
      ],
    },
  },

  // Test files - relaxed rules for testing flexibility (no type-aware linting)
  {
    files: ['**/*.test.ts', '**/*.spec.ts', '**/test/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        // No project option - test files are excluded from tsconfig.json
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
      // Allow console.log in tests for debugging
      'no-console': 'off',
      // Allow non-null assertions in tests (common and safe in test setup)
      '@typescript-eslint/no-non-null-assertion': 'off',
      // Allow type inference for test helpers (explicit return types add verbosity without value)
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      // Allow any in tests for mocking (necessary for test utilities)
      '@typescript-eslint/no-explicit-any': 'off',
      // Unused vars/args starting with _ are ignored
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          args: 'all',
          ignoreRestSiblings: true,
        },
      ],
      // Turn off base ESLint no-unused-vars (use TypeScript version)
      'no-unused-vars': 'off',
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
