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

// Legacy per-window segment identifiers (SEG_STACK, SEG_RSTACK, SEG_GLOBAL) have been removed.
// Use SEG_DATA with absolute byte addresses and window base constants (GLOBAL_BASE/STACK_BASE/RSTACK_BASE)
// for all memory I/O; classification-sensitive code should infer region by address range.

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

// Derived cell-based constants (no behavior change)
// Use these to keep arithmetic in cells and avoid repeated divisions by CELL_SIZE.
export const GLOBAL_BASE_CELLS = GLOBAL_BASE / CELL_SIZE;
export const GLOBAL_TOP_CELLS = GLOBAL_TOP / CELL_SIZE;

export const STACK_BASE_CELLS = STACK_BASE / CELL_SIZE;
export const STACK_TOP_CELLS = STACK_TOP / CELL_SIZE;

export const RSTACK_BASE_CELLS = RSTACK_BASE / CELL_SIZE;
export const RSTACK_TOP_CELLS = RSTACK_TOP / CELL_SIZE;

export const DATA_BASE_CELLS = DATA_BASE / CELL_SIZE;
export const DATA_TOP_CELLS = DATA_TOP / CELL_SIZE;

export const GLOBAL_SIZE_CELLS = (GLOBAL_TOP - GLOBAL_BASE) / CELL_SIZE;
export const STACK_SIZE_CELLS = (STACK_TOP - STACK_BASE) / CELL_SIZE;
export const RSTACK_SIZE_CELLS = (RSTACK_TOP - RSTACK_BASE) / CELL_SIZE;

export const TOTAL_DATA_CELLS = TOTAL_DATA_BYTES / CELL_SIZE;

/** Maximum opcode value for built-in operations (0-127) */
export const MAX_BUILTIN_OPCODE = 127;

/** Minimum opcode value for user-defined words (128+) */
export const MIN_USER_OPCODE = 128;
