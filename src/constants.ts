// Constants
export const BLOCK_SIZE = 16; // Each block is 16 bytes
export const MEMORY_SIZE = 0x2000; // Total memory size (8 KB)
export const NIL = -1; // Represents a null pointer

// Memory regions and sizes
export const STACK = 0; // Stack starts at address 0
export const STACK_SIZE = 0x100; // Stack size (256 bytes)

export const RSTACK = STACK + STACK_SIZE; // Return stack starts after the stack
export const RSTACK_SIZE = 0x100; // Return stack size (256 bytes)

export const TIB = RSTACK + RSTACK_SIZE; // Terminal Input Buffer (TIB) starts after the return stack
export const TIB_SIZE = 0x100; // TIB size (256 bytes)

export const PAD = TIB + TIB_SIZE; // PAD starts after the TIB
export const PAD_SIZE = 0x100; // PAD size (256 bytes)

export const CODE = PAD + PAD_SIZE; // Code area starts after the PAD
export const CODE_SIZE = 0x400; // Code area size (1 KB)

export const VARS = CODE + CODE_SIZE; // Variables area starts after the code area
export const VARS_SIZE = 0x100; // Variables area size (256 bytes)

export const HEAP = VARS + VARS_SIZE; // Heap starts after the variables area
export const HEAP_SIZE = 0x1000; // Heap size (4 KB)

