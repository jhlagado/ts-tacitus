/**
 * @file src/strings/string.ts
 * 
 * This file provides string creation functionality for the Tacit VM.
 * 
 * It contains utilities for creating tagged string values that can be used
 * within the VM. Strings in Tacit are stored in the string digest and referenced
 * by their address, which is then tagged with the STRING tag to create a tagged value.
 */

import { Digest } from './digest';
import { Tag, toTaggedValue } from '../core/tagged';

/**
 * Creates a tagged string value
 * 
 * This function adds a string to the digest and returns a tagged value
 * that references the string. The tagged value contains the address of the
 * string in the digest, tagged with the STRING tag.
 * 
 * @param {Digest} digest - The string digest to store the string in
 * @param {string} value - The string value to store
 * @returns {number} A tagged value representing the string
 * @throws {Error} If the string is too long or if there's not enough space in the digest
 */
export function stringCreate(digest: Digest, value: string): number {
  // Add the string to the digest and get its address
  const address = digest.add(value);
  
  // Create and return a tagged value with the STRING tag
  return toTaggedValue(address, Tag.STRING);
}
