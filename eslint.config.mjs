// Simple ESLint configuration for JavaScript files only
// TypeScript files are excluded to avoid parsing errors

/** @type {import('eslint').Linter.FlatConfig[]} */
const config = [
  // Shared ignores for all configurations
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/*.ts',  // Ignore all TypeScript files
      '**/*.tsx', // Ignore all TypeScript React files
      '**/*.d.ts',
      '**/*.js.map'
    ]
  },
  // JavaScript files with relaxed rules
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        module: 'readonly',
        require: 'readonly',
        console: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        global: 'readonly',
      },
    },
    rules: {
      // Very minimal rules
      'no-unused-vars': 'warn',
      'no-undef': 'warn',
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
        console: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      // Very minimal rules
      'no-unused-vars': 'warn',
      'no-undef': 'warn',
      'no-console': 'off',
    },
  },
];

export default config;

