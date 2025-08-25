// build-dependency-map.js
// Utility to generate a Markdown dependency map for all TS files in src/
// Usage: node build-dependency-map.js

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, 'src');
const OUTPUT_MD = path.join(__dirname, 'docs', 'dependency-map.md');

function getAllTSFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllTSFiles(filePath));
    } else if (file.endsWith('.ts')) {
      results.push(filePath);
    }
  });
  return results;
}

function parseImports(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const importRegex = /import\s+(?:[^'";]+from\s+)?["']([^"']+)["']/g;
  const imports = [];
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

function buildDependencyMap() {
  const files = getAllTSFiles(SRC_DIR);
  const map = {};
  files.forEach(absPath => {
    const relPath = path.relative(SRC_DIR, absPath);
    map[relPath] = parseImports(absPath);
  });
  return map;
}

function writeMarkdown(map) {
  let md = '# TypeScript Dependency Map\n\n';
  md += 'This file is auto-generated. It lists all imports for each TS file in `src/`.\n\n';
  Object.entries(map).forEach(([file, imports]) => {
    md += `## ${file}\n`;
    if (imports.length === 0) {
      md += '_No imports_\n\n';
    } else {
      imports.forEach(imp => {
        md += `- \`${imp}\`\n`;
      });
      md += '\n';
    }
  });
  fs.writeFileSync(OUTPUT_MD, md, 'utf8');
  console.log(`Dependency map written to ${OUTPUT_MD}`);
}

if (require.main === module) {
  const map = buildDependencyMap();
  writeMarkdown(map);
}
