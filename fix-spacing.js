#!/usr/bin/env node

/* global console, process */

/**
 * This script ensures blank lines between functions in TypeScript files
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = '/Users/johnhardy/Documents/projects/ts-tacitus';

// Process source files that need blank lines between functions
fixSpacingInFiles();

/**
 * Main function to fix spacing in files
 */
function fixSpacingInFiles() {
  // Find all TypeScript files
  const tsFiles = findTypeScriptFiles(path.join(PROJECT_ROOT, 'src'));
  let modifiedCount = 0;
  
  // Process each file to ensure blank lines between functions
  tsFiles.forEach(file => {
    const original = fs.readFileSync(file, 'utf8');
    let content = original;
    
    // Pattern 1: Add blank lines between function declarations and the next function/class/etc
    content = content.replace(/}\n(?!\s*\n)(export |function |const |class |interface |type )/g, '}\n\n$1');
    
    // Pattern 2: Add blank lines between methods and test blocks
    content = content.replace(/}\n(?!\s*\n)(\s+)(test|describe|beforeEach|afterEach|afterAll|beforeAll)/g, '}\n\n$1$2');
    
    // Pattern 3: Add blank lines after imports block
    content = content.replace(/(import .+;\n)(?!\n|import)/g, '$1\n');
    
    // Additional patterns for fileProcessor.ts and similar files
    content = content.replace(/}\n(?!\s*\n)\/\*\*/g, '}\n\n/**');
    content = content.replace(/}\n(?!\s*\n)export function/g, '}\n\nexport function');
    
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
