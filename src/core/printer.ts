/**
 * @file src/core/printer.ts
 * 
 * This file provides utilities for printing and formatting Tacit VM values
 * for debugging and development purposes. It includes functions for displaying
 * tagged values with their type information and content in a human-readable format.
 * 
 * Unlike the format-utils.ts module which is focused on user-facing output,
 * this module is primarily intended for development and debugging, providing
 * more detailed technical information about the internal representation of values.
 */

import { fromTaggedValue, Tag, tagNames } from './tagged';

/**
 * Recursively prints any Tacit value with indentation, tags, and contents.
 * 
 * This is the main entry point for debugging output of Tacit values.
 * It prints a title followed by a formatted representation of the value.
 * 
 * @param title - A descriptive title to prefix the output
 * @param tval - The tagged value to print
 */
export function prn(title: string, tval: number): void {
  console.warn(`${title ?? ''}: ${formatValue(tval, 0)}`);
}

/**
 * Formats a tagged value as a string with proper indentation.
 * 
 * This function handles the formatting of a tagged value, including its tag name
 * and scalar representation. It supports indentation for nested structures.
 * 
 * @param tval - The tagged value to format
 * @param indent - The indentation level (default: 0)
 * @returns A formatted string representation of the tagged value
 */
function formatValue(tval: number, indent = 0): string {
  const { value: _value, tag } = fromTaggedValue(tval);
  const name = toTagName(tag);
  const prefix = `${'  '.repeat(indent)}${name}: `;
  return `${prefix}${scalarRepr(tval)}`;
}

/**
 * Converts a tag number to its string name.
 * 
 * This function maps tag numbers to their corresponding names from the Tag enum.
 * If the tag is not recognized, it returns a string indicating an unknown tag.
 * 
 * @param tag - The tag number to convert
 * @returns The string name of the tag
 */
function toTagName(tag: number): string {
  return tagNames[tag as Tag] || `UnknownTag(${tag})`;
}

/**
 * Generates a scalar representation of a tagged value.
 * 
 * This function produces a string representation of a tagged value based on its tag type:
 * - INTEGER: The numeric value as a string
 * - CODE: A placeholder "<code>" string
 * - STRING: A string representation with its digest index
 * - Other tags: The raw numeric value
 * 
 * @param tval - The tagged value to represent
 * @returns A string representation of the value
 */
function scalarRepr(tval: number): string {
  const { tag, value } = fromTaggedValue(tval);
  switch (tag) {
    case Tag.INTEGER:
      return `${value}`;
    case Tag.CODE:
      return `<code>`;
    case Tag.STRING:
      return `"[string:${value}]"`;
    default:
      return `${tval}`;
  }
}
