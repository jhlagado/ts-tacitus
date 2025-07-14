// Convert test files from it() to test()
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const testFiles = findTestFiles('/Users/johnhardy/Documents/projects/ts-tacitus/src');

testFiles.forEach(file => {
  console.log(`Processing ${file}`);
  let content = fs.readFileSync(file, 'utf8');

  content = content.replace(/\bit\(/g, 'test(');

  fs.writeFileSync(file, content);
});

console.log('Running prettier to format files...');
try {
  execSync('yarn prettier --write "src/**/*.{ts,tsx,js,jsx}"', { stdio: 'inherit' });
  console.log('✅ All files processed successfully');
} catch (error) {
  console.error('Error running prettier:', error);
}

/**
 * Recursively find all test files in the directory
 */
function findTestFiles(dir) {
  let results = [];
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      results = results.concat(findTestFiles(filePath));
    } else if (file.endsWith('.test.ts') || file.endsWith('.test.tsx')) {
      results.push(filePath);
    }
  });

  return results;
}
