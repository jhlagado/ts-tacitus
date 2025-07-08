import * as fs from 'fs';
import * as path from 'path';
import { executeLine, setupInterpreter } from './executor';

export const TACIT_FILE_EXTENSION = '.tacit';

/**
 * Ensures a file path has the correct extension
 */
function ensureFileExtension(filePath: string): string {
  if (path.extname(filePath) === '') {
    return filePath + TACIT_FILE_EXTENSION;
  }
  return filePath;
}

/**
 * Processes a single Tacit file
 * @returns True if successful, false if errors occurred
 */

export function processFile(filePath: string): boolean {
  const filePathWithExt = ensureFileExtension(filePath);
  try {
    const absolutePath = path.resolve(filePathWithExt);
    console.log(`Processing Tacit file: ${absolutePath}`);
    if (!fs.existsSync(absolutePath)) {
      console.error(`File not found: ${absolutePath}`);
      return false;
    }
    const content = fs.readFileSync(absolutePath, 'utf8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '' || line.startsWith('\\')) {
        continue;
      }

      try {
        executeLine(line);
      } catch (error) {
        console.error(`Error in file ${filePathWithExt} at line ${i + 1}:`);
        if (error instanceof Error) {
          console.error(`  ${error.message}`);
        } else {
          console.error('  Unknown error occurred');
        }
        return false;
      }
    }
    return true;
  } catch (error) {
    console.error(`Failed to read file ${filePathWithExt}:`);
    if (error instanceof Error) {
      console.error(`  ${error.message}`);
    }
    return false;
  }
}

/**
 * Processes multiple Tacit files
 */

export function processFiles(
  files: string[],
  exitOnError = true,
  processFileFn: (filePath: string) => boolean = processFile,
): boolean {
  setupInterpreter();
  console.log('Tacit file processing mode:');
  let allSucceeded = true;
  for (const file of files) {
    const success = processFileFn(file);
    if (!success) {
      allSucceeded = false;
      console.log('Processing stopped due to error.');
      if (exitOnError) {
        process.exit(1);
      }
      break;
    }
  }

  if (allSucceeded) {
    console.log('All Tacit files processed successfully.');
  }
  return allSucceeded;
}
