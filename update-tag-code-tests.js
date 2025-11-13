#!/usr/bin/env node
/**
 * Helper script to update test files for X1516 encoding
 * Updates Tagged(..., Tag.CODE) to use encodeX1516
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Find all test files with Tag.CODE usage
const testFiles = execSync(
  'find src/test -name "*.test.ts" -exec grep -l "Tagged.*Tag\\.CODE" {} \\;',
  { encoding: 'utf-8' },
)
  .trim()
  .split('\n')
  .filter(Boolean);

console.log(`Found ${testFiles.length} test files to update`);

for (const file of testFiles) {
  let content = fs.readFileSync(file, 'utf-8');
  let modified = false;

  // Check if encodeX1516 is already imported
  if (!content.includes('encodeX1516')) {
    // Try to add import after existing imports from core
    const importMatch = content.match(/import.*from ['"]\.\.\/\.\.\/core['"];?/);
    if (importMatch) {
      const importLine = importMatch[0];
      if (!importLine.includes('code-ref')) {
        // Add encodeX1516 import
        const newImport = importLine.replace(
          /from ['"]\.\.\/\.\.\/core['"]/,
          "from '../../core/code-ref'",
        );
        content = content.replace(
          importLine,
          `${importLine}\nimport { encodeX1516 } from '../../core/code-ref';`,
        );
        modified = true;
      }
    }
  }

  // Update Tagged(address, Tag.CODE, ...) to Tagged(encodeX1516(address), Tag.CODE, ...)
  // This is a simple pattern match - be careful with edge cases
  const pattern = /Tagged\((\s*)([0-9xXa-fA-F_]+)(\s*),\s*Tag\.CODE/g;
  const replacement = (match, space1, address, space2) => {
    // Skip if already wrapped
    if (match.includes('encodeX1516')) return match;
    return `Tagged(${space1}encodeX1516(${address})${space2}, Tag.CODE`;
  };

  const newContent = content.replace(pattern, replacement);
  if (newContent !== content) {
    modified = true;
    content = newContent;
  }

  if (modified) {
    fs.writeFileSync(file, content, 'utf-8');
    console.log(`Updated: ${file}`);
  }
}

console.log('Done!');
