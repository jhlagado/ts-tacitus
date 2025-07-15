/**
 * @file src/core/constants.ts
 * Core constants used throughout the Tacit VM implementation.
 * These constants define memory sizes, boolean values, and other fundamental values.
 */

/** Size of a memory segment in bytes (64KB) */
export const SEG_SIZE = 0x10000;

/** Special value representing an invalid memory address or reference */
export const INVALID = SEG_SIZE - 1;

/** Boolean false value (0) */
export const FALSE = 0;

/** Boolean true value (1) */
export const TRUE = 1;

/** Size of a memory cell in bytes (4 bytes) */
export const CELL_SIZE = 4;

/** Number of bytes per stack element (32-bit float = 4 bytes) */
export const BYTES_PER_ELEMENT = 4;

/** Total memory size in bytes (64KB) */
export const MEMORY_SIZE = 65536;

/** Segment ID for the data stack */
export const SEG_STACK = 0;

/** Segment ID for the return stack */
export const SEG_RSTACK = 1;

/** Segment ID for the code segment */
export const SEG_CODE = 4;

/** Segment ID for the string segment */
export const SEG_STRING = 5;

/** Size of the data stack in bytes (256 bytes) */
export const STACK_SIZE = 0x0100;

/** Size of the return stack in bytes (256 bytes) */
export const RSTACK_SIZE = 0x0100;

/** Size of the string segment in bytes (2KB) */
export const STRING_SIZE = 0x0800;

/** Size of the code segment in bytes (8KB) */
export const CODE_SIZE = 0x2000;
