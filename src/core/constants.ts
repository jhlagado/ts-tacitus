/**
 * @file src/core/constants.ts
 * Core constants for the Tacit VM.
 */

export const SEG_SIZE = 0x10000;

export const INVALID = SEG_SIZE - 1;

export const FALSE = 0;

export const TRUE = 1;

export const CELL_SIZE = 4;

export const MEMORY_SIZE = 65536;

export const SEG_STACK = 0;

export const SEG_RSTACK = 1;

export const SEG_GLOBAL = 2;

// Unified data segment identifier (compat placeholder for Phase A). Not yet used broadly.
export const SEG_DATA = 3;

export const SEG_CODE = 4;

export const SEG_STRING = 5;

export const STACK_SIZE = 0x0100;

export const RSTACK_SIZE = 0x0100;

export const GLOBAL_SIZE = 0x0100;

export const STRING_SIZE = 0x0800;

export const CODE_SIZE = 0x2000;

// Unified arena boundaries (byte offsets)
export const GLOBAL_BASE = 0x0000;
export const GLOBAL_TOP = GLOBAL_BASE + GLOBAL_SIZE;

export const STACK_BASE = GLOBAL_TOP;
export const STACK_TOP = STACK_BASE + STACK_SIZE;

export const RSTACK_BASE = STACK_TOP;
export const RSTACK_TOP = RSTACK_BASE + RSTACK_SIZE;

export const TOTAL_DATA_BYTES = RSTACK_TOP;

// Unified data segment boundaries (aliasing the whole data arena)
export const DATA_BASE = GLOBAL_BASE;
export const DATA_TOP = TOTAL_DATA_BYTES;

/** Maximum opcode value for built-in operations (0-127) */
export const MAX_BUILTIN_OPCODE = 127;

/** Minimum opcode value for user-defined words (128+) */
export const MIN_USER_OPCODE = 128;
