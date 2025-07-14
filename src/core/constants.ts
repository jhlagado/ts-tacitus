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
