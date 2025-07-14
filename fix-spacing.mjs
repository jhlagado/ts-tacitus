#!/usr/bin/env node

/**
 * This script ensures proper spacing in TypeScript files:
 * - No blank lines between imports, one blank line after import block
 * - No blank lines between exported constants, one blank line after export block
 * - Blank lines between functions and methods
 * - Blank lines after variable declarations in classes
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const PROJECT_ROOT = '/Users/johnhardy/Documents/projects/ts-tacitus';

fixSpacingInFiles();

/**
 * Main function to fix spacing in files
 */
function fixSpacingInFiles() {
  const tsFiles = findTypeScriptFiles(path.join(PROJECT_ROOT, 'src'));
  let modifiedCount = 0;

  tsFiles.forEach(file => {
    const original = fs.readFileSync(file, 'utf8');

    let content = original;

    content = fixImportExportSpacing(content);

    content = fixFunctionAndMethodSpacing(content);

    content = fixClassVariableSpacing(content);

    if (content !== original) {
      fs.writeFileSync(file, content);
      modifiedCount++;
    }
  });

  console.log(`Modified ${modifiedCount} files with spacing fixes`);

  try {
    console.log('Running prettier to finalize formatting...');
    execSync('yarn prettier --write "src/**/*.{ts,tsx,js,jsx}"', {
      stdio: 'inherit',
      cwd: PROJECT_ROOT,
    });
    console.log('✅ All files formatted successfully');
  } catch (error) {
    console.error('Error running prettier:', error);
    process.exit(1);
  }
}

/**
 * Fix import, export, and variable spacing
 * - No blank lines between imports, exports, or variable declarations
 * - One blank line after blocks of imports, exports, and variables
 */
function fixImportExportSpacing(content) {
  content = content.replace(/(import .+;)\s*\n\s*\n(import)/g, '$1\n$2');

  content = content.replace(/^((?:import .+;\n)+)(?!\n)/gm, '$1\n');

  content = content.replace(/^(export .+;)\s*\n\s*\n(export)/gm, '$1\n$2');

  let previousContent;
  do {
    previousContent = content;
    content = content.replace(/(export const .+;)\s*\n\s*\n(export)/g, '$1\n$2');
  } while (previousContent !== content);

  content = content.replace(/(^const [^;\n]+;)\s*\n\s*\n(const)/gm, '$1\n$2');
  content = content.replace(/(^let [^;\n]+;)\s*\n\s*\n(const|let)/gm, '$1\n$2');
  content = content.replace(/(^var [^;\n]+;)\s*\n\s*\n(const|let|var)/gm, '$1\n$2');

  let constantsModified;
  do {
    previousContent = content;

    content = content.replace(/^(const|let|var)( .+;)\s*\n\s*\n(const|let|var)/gm, '$1$2\n$3');
    constantsModified = previousContent !== content;
  } while (constantsModified);

  return content;
}

/**
 * Fix function and method spacing
 * - Blank lines between functions
 * - Blank lines between methods
 * - Blank lines before and after blocks
 */
function fixFunctionAndMethodSpacing(content) {
  content = content.replace(
    /}\n(?!\s*\n)(export |function |const |class |interface |type )/g,
    '}\n\n$1',
  );

  content = content.replace(/(\s+)}\n(\s+)(?!\s*\n)/g, '$1}\n\n$2');

  content = content.replace(/}\n(?!\s*\n)\/\*\*/g, '}\n\n/**');
  content = content.replace(/}\n(?!\s*\n)export function/g, '}\n\nexport function');

  return content;
}

/**
 * Fix class variable spacing
 * - Add blank line after variable declarations before methods
 */
function fixClassVariableSpacing(content) {
  content = content.replace(/(\s+)(\w+: [^;]+;\n)+(?!\s*\n)(\s+\w+\()/g, '$1$2\n$3');

  content = content.replace(/^(?:const [^;]+;\n)+(?!\n)/gm, '$&\n');

  content = content.replace(
    /(\s+(?:const|let|var) .+;)\n\s*\n(\s+(?:const|let|var|return|if|for|while|switch))/g,
    '$1\n$2',
  );

  content = content.replace(
    /(\s+[^\s{};]+.+;)\n\s*\n(\s+(?:[^\s{};]|return|if|for|while|switch))/g,
    '$1\n$2',
  );

  return content;
}

/**
 * Recursively find all TypeScript files in the directory
 */
function findTypeScriptFiles(dir) {
  let results = [];
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      results = results.concat(findTypeScriptFiles(filePath));
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      results.push(filePath);
    }
  });

  return results;
}
