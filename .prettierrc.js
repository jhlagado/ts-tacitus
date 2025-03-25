module.exports = {
  // Basic formatting options
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  quoteProps: "as-needed",
  jsxSingleQuote: false,
  trailingComma: "es5",
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: "avoid",

  // Special file overrides
  overrides: [
    {
      files: "*.md",
      options: {
        proseWrap: "preserve"
      }
    }
  ],

  // Ensure newlines at end of files
  endOfLine: "lf",

  // TypeScript-specific options
  importOrder: ["^@core/(.*)$", "^@server/(.*)$", "^@ui/(.*)$", "^[./]"],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true
};
