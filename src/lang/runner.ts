import * as fs from 'fs';
import * as path from 'path';
import { execute } from "./interpreter";
import { parse } from "./parser";
import { lex } from "./lexer";
import { initializeInterpreter, vm } from "../core/globalState";

// Define the language file extension
export const TACIT_FILE_EXTENSION = '.tacit';

/**
 * Ensures a file path has the correct extension
 * @param filePath Path to verify
 * @returns Path with proper extension
 */
function ensureFileExtension(filePath: string): string {
  if (path.extname(filePath) === '') {
    return filePath + TACIT_FILE_EXTENSION;
  }
  return filePath;
}

/**
 * Processes a Tacit file through the interpreter
 * @param filePath Path to the file to process
 * @returns True if processing succeeded, false if there was an error
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
      if (line === '' || line.startsWith('//')) continue;
      
      try {
        const tokens = lex(line);
        parse(tokens);
        execute(vm.compiler.BP);
      } catch (error) {
        console.error(`Error in file ${filePathWithExt} at line ${i + 1}:`);
        if (error instanceof Error) {
          console.error(`  ${error.message}`);
        } else {
          console.error("  Unknown error occurred");
        }
        return false; // Stop on first error in file mode
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
 * Runs the interpreter on the specified files
 * @param files Array of file paths to process
 */
export function runFiles(files: string[]): void {
  initializeInterpreter();
  
  console.log("Tacit file processing mode:");
  for (const file of files) {
    const success = processFile(file);
    if (!success) {
      console.log("Processing stopped due to error.");
      process.exit(1); // Exit with error code on file error
    }
  }
  console.log("All Tacit files processed successfully.");
}