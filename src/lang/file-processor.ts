/**
 * @file src/lang/file-processor.ts
 *
 * This file provides utilities for processing Tacit source files.
 *
 * The file processor is responsible for reading Tacit source files from disk,
 * parsing them line by line, and executing the code. It handles file extension
 * management, error reporting with line numbers, and batch processing of multiple files.
 */

import * as fs from 'fs';
import * as path from 'path';

import { type VM, createVM } from '../core/vm';
import { executeProgram } from './runner';

/** The standard file extension for Tacit source files */
export const TACIT_FILE_EXTENSION = '.tacit';

/**
 * Ensures a file path has the correct Tacit extension.
 *
 * If the file path doesn't have an extension, this function appends the standard
 * Tacit file extension (.tacit). If it already has an extension, it's returned unchanged.
 *
 * @param {string} filePath - The file path to check and potentially modify
 * @returns {string} The file path with the correct extension
 */
function ensureFileExtension(filePath: string): string {
  if (path.extname(filePath) === '') {
    return filePath + TACIT_FILE_EXTENSION;
  }

  return filePath;
}

/**
 * Processes a single Tacit file.
 *
 * This function reads a Tacit source file, processes it line by line, and executes each line.
 * It skips empty lines and comments (lines starting with #). If an error occurs during
 * execution, it reports the error with the line number and returns false.
 *
 * @param {VM} vm - The VM instance to use for execution
 * @param {string} filePath - The path to the Tacit file to process
 * @returns {boolean} True if the file was processed successfully, false if errors occurred
 */
export function processFile(vm: VM, filePath: string): boolean {
  const filePathWithExt = ensureFileExtension(filePath);
  try {
    const absolutePath = path.resolve(filePathWithExt);
    if (!fs.existsSync(absolutePath)) {
      console.error(`File not found: ${absolutePath}`);
      return false;
    }

    const content = fs.readFileSync(absolutePath, 'utf8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '' || line.startsWith('#')) {
        continue;
      }

      try {
        executeProgram(vm, line);
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
 * Processes multiple Tacit files in sequence.
 *
 * This function creates a VM and then processes each file in the provided array.
 * If a file fails to process and exitOnError is true, the process will exit with
 * an error code. Otherwise, it will continue with the next file.
 *
 * @param {string[]} files - Array of file paths to process
 * @param {boolean} [exitOnError=true] - Whether to exit the process if an error occurs
 * @param {Function} [processFileFn] - Function to use for processing each file
 * @returns {boolean} True if all files were processed successfully, false otherwise
 */
export function processFiles(
  files: string[],
  exitOnError = true,
  processFileFn?: (vm: VM, filePath: string) => boolean,
): boolean {
  const vm = createVM();
  const fn = processFileFn ?? processFile;
  let allSucceeded = true;
  for (const file of files) {
    const success = fn(vm, file);
    if (!success) {
      allSucceeded = false;
      // eslint-disable-next-line no-console
      console.log('Processing stopped due to error.');
      if (exitOnError) {
        process.exit(1);
      }

      break;
    }
  }

  if (allSucceeded) {
    // eslint-disable-next-line no-console
    console.log('All Tacit files processed successfully.');
  }

  return allSucceeded;
}
