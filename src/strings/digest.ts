/**
 * @file src/strings/digest.ts
 * Plain-object string digest with helper functions for Tacit VM.
 */

import type { Memory } from '../core/memory';
import { memoryWrite8, memoryRead8 } from '../core/memory';
import { SEG_STRING, STRING_SIZE_BYTES } from '../core/constants';

const MAX_STRING_LENGTH = 255;
const STRING_HEADER_SIZE = 1;
const NOT_FOUND = -1;

export type Digest = {
  memory: Memory;
  SBP: number;
};

export function createDigest(memory: Memory): Digest {
  return {
    memory,
    SBP: 0,
  };
}

function ensureAddress(address: number): void {
  if (address < 0 || address >= STRING_SIZE_BYTES) {
    throw new Error('Address is outside memory bounds');
  }
}

export function digestAdd(digest: Digest, str: string): number {
  if (str.length > MAX_STRING_LENGTH) {
    throw new Error(`String too long (max ${MAX_STRING_LENGTH} characters)`);
  }

  const requiredSpace = STRING_HEADER_SIZE + str.length;
  if (digest.SBP + requiredSpace > STRING_SIZE_BYTES) {
    throw new Error('String digest overflow');
  }

  const startAddress = digest.SBP;
  memoryWrite8(digest.memory, SEG_STRING, digest.SBP++, str.length);
  for (let i = 0; i < str.length; i += 1) {
    memoryWrite8(digest.memory, SEG_STRING, digest.SBP++, str.charCodeAt(i));
  }

  return startAddress;
}

export function digestLength(digest: Digest, address: number): number {
  ensureAddress(address);
  return memoryRead8(digest.memory, SEG_STRING, address);
}

export function digestGet(digest: Digest, address: number): string {
  ensureAddress(address);
  let pointer = address;
  const length = memoryRead8(digest.memory, SEG_STRING, pointer);
  pointer += 1;

  if (pointer + length > STRING_SIZE_BYTES) {
    throw new Error('Address is outside memory bounds');
  }

  let str = '';
  for (let i = 0; i < length; i += 1) {
    str += String.fromCharCode(memoryRead8(digest.memory, SEG_STRING, pointer + i));
  }
  return str;
}

export function digestRemainingSpace(digest: Digest): number {
  return STRING_SIZE_BYTES - digest.SBP;
}

export function digestFind(digest: Digest, str: string): number {
  let pointer = 0;

  while (pointer < digest.SBP) {
    const length = memoryRead8(digest.memory, SEG_STRING, pointer);

    if (pointer + STRING_HEADER_SIZE + length > STRING_SIZE_BYTES) {
      throw new Error('Address is outside memory bounds');
    }

    let existing = '';
    for (let i = 0; i < length; i += 1) {
      existing += String.fromCharCode(
        memoryRead8(digest.memory, SEG_STRING, pointer + STRING_HEADER_SIZE + i),
      );
    }

    if (existing === str) {
      return pointer;
    }

    pointer += STRING_HEADER_SIZE + length;
  }

  return NOT_FOUND;
}

export function digestIntern(digest: Digest, str: string): number {
  const existing = digestFind(digest, str);
  if (existing !== NOT_FOUND) {
    return existing;
  }
  return digestAdd(digest, str);
}
