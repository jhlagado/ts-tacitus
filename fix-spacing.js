#!/usr/bin/env node

/* global console, process */

/**
 * This script ensures proper spacing in TypeScript files:
 * - No blank lines between imports, one blank line after import block
 * - No blank lines between exported constants, one blank line after export block
 * - Blank lines between functions and methods
 * - Blank lines after variable declarations in classes
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = '/Users/johnhardy/Documents/projects/ts-tacitus';

// Process source files that need proper spacing
fixSpacingInFiles();

/**
 * Main function to fix spacing in files
 */
function fixSpacingInFiles() {
  // Find all TypeScript files
  const tsFiles = findTypeScriptFiles(path.join(PROJECT_ROOT, 'src'));
  let modifiedCount = 0;
  
  // Process each file to ensure proper spacing
  tsFiles.forEach(file => {
    const original = fs.readFileSync(file, 'utf8');
    
    // Fix spacing in multiple passes for more reliable results
    let content = original;
    
    // Pass 1: Remove blank lines between imports and between exports
    content = fixImportExportSpacing(content);
    
    // Pass 2: Add blank lines between functions and methods
    content = fixFunctionAndMethodSpacing(content);
    
    // Pass 3: Add blank lines after class variable declarations
    content = fixClassVariableSpacing(content);
    
    // Only write if content changed
    if (content !== original) {
      fs.writeFileSync(file, content);
      modifiedCount++;
    }
  });
  
  console.log(`Modified ${modifiedCount} files with spacing fixes`);
  
  // Run prettier for final clean-up
  try {
    console.log('Running prettier to finalize formatting...');
    execSync('yarn prettier --write "src/**/*.{ts,tsx,js,jsx}"', { 
      stdio: 'inherit',
      cwd: PROJECT_ROOT
    });
    console.log('✅ All files formatted successfully');
  } catch (error) {
    console.error('Error running prettier:', error);
    process.exit(1);
  }
}

/**
 * Fix import and export spacing
 * - No blank lines between imports or between exports
 * - One blank line after a block of imports/exports
 */
function fixImportExportSpacing(content) {
  // Step 1: Remove blank lines between imports
  content = content.replace(/(import .+;)\s*\n\s*\n(import)/g, '$1\n$2');
  
  // Step 2: Remove blank lines between exported constants/variables
  content = content.replace(/(export const [^;]+;)\s*\n\s*\n(export const)/g, '$1\n$2');
  content = content.replace(/(export let [^;]+;)\s*\n\s*\n(export (const|let))/g, '$1\n$2');
  content = content.replace(/(export var [^;]+;)\s*\n\s*\n(export (const|let|var))/g, '$1\n$2');
  
  // Step 3: Ensure one blank line after import blocks
  content = content.replace(/^((?:import .+;\n)+)(?!\n)/gm, '$1\n');
  
  // Step 4: Ensure one blank line after export blocks
  content = content.replace(/^((?:export (?:const|let|var) .+;\n)+)(?!\n)/gm, '$1\n');
  
  return content;
}

/**
 * Fix function and method spacing
 * - Blank lines between functions
 * - Blank lines between methods
 * - Blank lines before and after blocks
 */
function fixFunctionAndMethodSpacing(content) {
  // Add blank lines between function declarations
  content = content.replace(/}\n(?!\s*\n)(export |function |const |class |interface |type )/g, '}\n\n$1');
  
  // Add blank lines between class methods
  content = content.replace(/(\s+)}\n(\s+)(?!\s*\n)/g, '$1}\n\n$2');
  
  // Add blank lines after JSDoc blocks before functions
  content = content.replace(/}\n(?!\s*\n)\/\*\*/g, '}\n\n/**');
  content = content.replace(/}\n(?!\s*\n)export function/g, '}\n\nexport function');
  
  return content;
}

/**
 * Fix class variable spacing
 * - Add blank line after variable declarations before methods
 */
function fixClassVariableSpacing(content) {
  // Add blank lines after class variable declarations before methods
  content = content.replace(/(\s+)(\w+: [^;]+;\n)+(?!\s*\n)(\s+\w+\()/g, '$1$2\n$3');
  
  // Add blank lines after constant declarations (outside classes)
  content = content.replace(/^(?:const [^;]+;\n)+(?!\n)/gm, '$&\n');
  
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
