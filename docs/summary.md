# TACITUS VIRTUAL MACHINE: KNOWLEDGE TRANSFER DOCUMENT

## 1. ARCHITECTURE OVERVIEW

### 1.1 Core Design Philosophy
- Stack-based virtual machine implementing the Tacit programming language
- Design optimized for constrained environments (64KB total memory footprint)
- Fundamental philosophical pillars:
  - Extreme composability through RPN syntax and combinator-based programming
  - Immutability as core principle (all data structures are persistent/immutable)
  - Deterministic execution (no GC pauses, predictable performance)
  - Memory efficiency through structural sharing and copy-on-write semantics
  - Small core language with powerful composition operators
  - Human readability while maintaining machine efficiency

### 1.2 Stack-Based Execution Model
- Classical stack machine using Reverse Polish Notation (RPN)
- Data flows upward through stack, consumed by operations
- Stack structure (growing downward in memory):
  ```
  | Position | Description            |
  |----------|------------------------|
  | TOP      | Most recently pushed   |
  | TOP-1    | Second element         |
  | ...      | ...                    |
  | 0        | Bottom of stack        |
  ```
- Stack operations:
  - push(value): TOS++, stack[TOS] = value
  - pop(): value = stack[TOS], TOS--, return value
  - peek(): return stack[TOS] without popping
  - swap(): exchange stack[TOS] and stack[TOS-1]
  - dup(): push copy of stack[TOS]
  - drop(): TOS--

### 1.3 Return Stack for Call Management
- Secondary stack for function call management
- Stores instruction pointers for function returns
- Operations:
  - >R (to-R): Move TOS to return stack
  - R> (R-from): Move top of return stack to main stack
  - R@ (R-fetch): Copy top of return stack to main stack
- Allows for nested function calls with depth limited by return stack size
- Used internally by the VM for function call/return mechanism
- Also exposed to language for advanced stack manipulation patterns

### 1.4 Type System via NaN-boxing
- All values represented as 32-bit floats with NaN-boxing for type information
- IEEE-754 float specification: Sign(1) + Exponent(8) + Mantissa(23)
- NaN pattern with quiet bit set used for non-float values
- Type tags encoded in upper bits of mantissa
- Internal representation:
  ```
  IEEE-754 Float:    [S|EEEEEEEE|MMMMMMMMMMMMMMMMMMMMMMM]
  NaN-boxed value:   [S|11111111|1TTTTMMMMMMMMMMMMMMMMMM]
  ```
  - S: Sign bit (1 bit)
  - E: Exponent bits (all 1s for NaN, 8 bits)
  - 1: Quiet NaN bit (1 bit)
  - T: Type tag (4 bits)
  - M: Mantissa/value bits (18 bits)
- TypeTag enum values:
  - NUMBER = 0b0001 (direct integer up to 2^18)
  - FLOAT = 0b0010 (float stored in an allocated heap block)
  - POINTER = 0b0011 (address to heap-allocated structure)
  - SYMBOL = 0b0100 (symbol/word reference)
  - STRING = 0b0101 (interned string reference)
  - BOOLEAN = 0b0110 (true/false value)
  - UNDEFINED = 0b0111 (null/undefined value)
  - VECTOR = 0b1000 (vector reference)
  - SEQUENCE = 0b1001 (sequence iterator reference)
  - DICTIONARY = 0b1010 (dictionary reference)
  - CODE = 0b1011 (compiled code block reference)
  - CONTINUATION = 0b1100 (reserved for continuation passing)

### 1.5 Block-Based Heap Management
- Heap divided into fixed-size blocks (64 bytes each)
- Reference counting for deterministic memory management:
  - addRef(): Increment reference count
  - release(): Decrement reference count, free when zero
- Block structure:
  ```
  | Field       | Size (bytes) | Description                       |
  |-------------|--------------|-----------------------------------|
  | refCount    | 4            | Reference count                   |
  | blockType   | 1            | Type of block content             |
  | metadata    | 3            | Block-specific metadata           |
  | data        | 56           | Block data (14 float32 values)    |
  ```
- Allocation strategy:
  - First-fit allocation for new blocks
  - Free-list of released blocks
  - Block coalescing for large allocations
  - No compaction or garbage collection

### 1.6 Copy-on-Write Semantics
- All heap-allocated structures implement COW semantics
- When modifying data:
  1. Check reference count
  2. If refCount > 1, clone block before modifying
  3. Modify original block if refCount = 1
- Implementation pattern:
  ```typescript
  function modify(object, modification) {
    if (object.block.refCount > 1) {
      const newBlock = cloneBlock(object.block);
      applyModification(newBlock, modification);
      return { block: newBlock, ...object };
    }
    applyModification(object.block, modification);
    return object;
  }
  ```
- Enables efficient structural sharing for immutable data structures
- Maximizes memory efficiency while preserving immutability guarantees
- Critical for performance in constrained memory environments

### 1.7 RPN Syntax and Functional Composition
- All operations expressed in postfix notation (RPN)
- Benefits:
  - No need for parentheses to control evaluation order
  - Natural left-to-right execution matches mental model
  - Stack visualization is straightforward
  - Trivial to compile to bytecode
- Function composition pattern: 
  ```
  f(g(x)) becomes x g f in RPN
  ```
- Example transformations:
  - (2 + 3) * 4 → 2 3 + 4 *
  - max(sqrt(9), log(100)) → 9 sqrt 100 log max
  - filter(map([1,2,3], square), even) → [1,2,3] square map even filter

### 1.8 Concatenative Programming Model
- Programs constructed by function composition
- Words (functions) manipulate the stack directly
- No named parameters or return values
- Function signatures described by stack effects:
  ```
  square ( n -- n² )  // Takes n, returns n²
  swap ( a b -- b a ) // Takes a,b returns b,a
  ```
- Combinators used for higher-order operations:
  - map: Apply function to each element
  - filter: Select elements matching predicate
  - fold/reduce: Combine elements with binary operation

### 1.9 No Closures or Environment Capture
- Functions cannot capture variables from lexical environment
- Pure stack-based data flow
- State must be explicitly passed via stack
- No side effects except through specific I/O operations
- Benefits:
  - Simplified execution model
  - Predictable performance
  - Reduced memory overhead
  - Elimination of closure-related bugs

### 1.10 Execution Pipeline
- Source text → Tokenization → Parsing → Bytecode → VM Execution
- Components:
  - Tokenizer: Convert source to token stream
  - Parser: Convert tokens to bytecode operations
  - Compiler: Generate optimized bytecode
  - Interpreter: Execute bytecode instructions
- Interpretation loop:
  ```typescript
  function execute(startAddress) {
    vm.IP = startAddress;
    vm.running = true;
    
    while (vm.running) {
      const opcode = vm.memory.read8(SEG_CODE, vm.IP++);
      executeOp(opcode);
    }
  }
  ```

## 2. MEMORY MODEL

### 2.1 Segmented Memory Architecture
```
|SEG_CODE(0)|SEG_DATA(1)|SEG_HEAP(2)|SEG_STRING(3)|
|----16KB---|----16KB---|---16KB----|----16KB-----|
```

- Total memory size: 64KB (65536 bytes)
- Four logical segments of 16KB (16384 bytes) each:
  - SEG_CODE (0): Executable bytecode storage
  - SEG_DATA (1): Global variables and constants
  - SEG_HEAP (2): Dynamically allocated objects
  - SEG_STRING (3): String interning pool (Digest)
- Segment addressing:
  - Each memory address consists of segment ID (2 bits) and offset (14 bits)
  - Full addressing implemented as: (segmentID << 14) | offset
  - Limits each segment to 16384 bytes (2^14)
  - Segment validation on every memory access

### 2.2 Memory Access Interface
- Low-level operations:
  ```typescript
  read8(segment, address): number   // Read 1 byte
  read16(segment, address): number  // Read 2 bytes
  read32(segment, address): number  // Read 4 bytes
  readFloat32(segment, address): number  // Read 4-byte float
  
  write8(segment, address, value): void   // Write 1 byte
  write16(segment, address, value): void  // Write 2 bytes
  write32(segment, address, value): void  // Write 4 bytes
  writeFloat32(segment, address, value): void  // Write 4-byte float
  ```
- Bounds checking on every access
- Endianness handling (little-endian format used internally)
- Memory protection enforcement:
  - SEG_CODE: Read-only after compilation
  - SEG_DATA: Read-write
  - SEG_HEAP: Managed access via reference counting
  - SEG_STRING: Write-once (interned strings are immutable)

### 2.3 SEG_CODE Organization
- Bytecode instruction storage (executable code)
- First byte of each instruction is the opcode (8-bit)
- Following bytes contain operands if any
- Special regions:
  - 0x0000-0x0100: System vectors (reset, exceptions)
  - 0x0100-0x0200: Built-in function entry points
  - 0x0200-onwards: User-defined functions and compiled code
- Compilation pointer (CP) tracks current position in code segment
- Branch instructions use relative offsets (16-bit signed)
- Execution controlled by Instruction Pointer (IP)

### 2.4 SEG_DATA Organization
- Global variable storage
- Data segment pointers
- Constant pools
- System configuration
- Stack base pointers:
  - 0x0000-0x1000: Parameter stack (4KB, ~1024 values)
  - 0x1000-0x1800: Return stack (2KB, ~512 return addresses)
  - 0x1800-0x3C00: Available for global data (~8KB)
- Stack grows downward from high to low addresses
- Stack protection with bounds checking to prevent overflow/underflow

### 2.5 SEG_HEAP Organization
- Block-based heap allocation
- Each block is 64 bytes:
  ```
  | Offset | Size | Description                      |
  |--------|------|----------------------------------|
  | 0      | 4    | Reference count (32-bit integer) |
  | 4      | 1    | Block type identifier            |
  | 5      | 3    | Type-specific metadata           |
  | 8      | 56   | Block data (56 bytes)            |
  ```
- Block allocation strategy:
  - Free list stored as linked list of freed blocks
  - First-fit allocation algorithm
  - Blocks never physically split, smallest allocation unit is 64 bytes
  - Multiple blocks may be logically linked for larger structures
- Block types:
  - BLOCK_TYPE_FLOAT (0x01): 32-bit float storage
  - BLOCK_TYPE_VECTOR (0x02): Fixed-length array of values
  - BLOCK_TYPE_STRING (0x03): Mutable string storage
  - BLOCK_TYPE_DICTIONARY (0x04): Key-value dictionary
  - BLOCK_TYPE_SEQUENCE (0x05): Sequence iterator state
  - BLOCK_TYPE_CODE (0x06): Compiled code block
  - BLOCK_TYPE_ARRAY (0x07): Array with length header
- Memory management operations:
  - allocateBlock(): Allocate new 64-byte block
  - getFreeBlock(): Get block from free list
  - releaseBlock(): Return block to free list
  - compactBlocks(): Coalesce free blocks (manual operation)

### 2.6 SEG_STRING Organization
- String interning pool (Digest)
- Each string stored exactly once
- String structure:
  ```
  | Offset | Size | Description          |
  |--------|------|----------------------|
  | 0      | 1    | String length (byte) |
  | 1      | n    | UTF-8 encoded chars  |
  ```
- String table:
  - Hash-based lookup for efficient string deduplication
  - String address is direct offset into SEG_STRING
  - Strings never moved or collected once stored
- String operations:
  - add(str): Add string, return address
  - get(address): Retrieve string at address
  - length(address): Get length of string at address
  - compare(addr1, addr2): Compare two strings
  - concat(addr1, addr2): Create new string from concatenation

### 2.7 Tagged Pointers Implementation
- All values in the VM are 32-bit tagged values
- NaN-boxing structure:
  ```
  |Sign|Exponent|NaN Bit|Type Tag|Mantissa Value|
  | 1  |   8    |   1   |    4   |      18      |
  ```
- Float pattern: 0x7FC00000 to 0x7FFFFFFF
- NaN patterns by type:
  ```
  NUMBER:     0x7FC10000 | (value & 0x3FFFF)
  FLOAT:      0x7FC20000 | (heapAddress & 0x3FFFF)
  POINTER:    0x7FC30000 | (heapAddress & 0x3FFFF)
  SYMBOL:     0x7FC40000 | (symbolID & 0x3FFFF)
  STRING:     0x7FC50000 | (stringAddress & 0x3FFFF)
  // etc.
  ```
- Conversion functions:
  ```typescript
  toTaggedValue(value: number, type: TypeTag): number {
    return 0x7FC00000 | (type << 18) | (value & 0x3FFFF);
  }
  
  fromTaggedValue(taggedValue: number): { type: TypeTag, value: number, isHeap: boolean } {
    const type = (taggedValue >> 18) & 0xF;
    const value = taggedValue & 0x3FFFF;
    const isHeap = type === TypeTag.POINTER || type === TypeTag.FLOAT;
    return { type, value, isHeap };
  }
  ```
- Benefits of this approach:
  - Type and value unified in single 32-bit value
  - No tag bits needed for real floating-point values
  - No extra memory for type information
  - Fast type checking via bitmasking
  - Value range sufficient for addressing memory segments

### 2.8 HeapBlock Structure In-Depth
- Basic allocation unit (64 bytes per block)
- Block header (8 bytes):
  - refCount: Reference counter (4 bytes)
  - type: Block content type (1 byte)
  - size: Logical size/usage of block (1 byte)
  - flags: Special attributes (1 byte)
  - reserved: Reserved for future use (1 byte)
- Data region (56 bytes):
  - Stores block type-specific data
  - Capable of holding 14 float32 values
  - For larger structures, blocks can be linked
- Vector implementation:
  ```
  | Offset | Size | Description              |
  |--------|------|--------------------------|
  | 0      | 4    | Reference count          |
  | 4      | 1    | Type (BLOCK_TYPE_VECTOR) |
  | 5      | 1    | Length of vector         |
  | 6      | 2    | Reserved/flags           |
  | 8      | 4*n  | Vector elements          |
  ```
- Dictionary implementation:
  ```
  | Offset | Size | Description                  |
  |--------|------|------------------------------|
  | 0      | 4    | Reference count              |
  | 4      | 1    | Type (BLOCK_TYPE_DICTIONARY) |
  | 5      | 1    | Number of entries            |
  | 6      | 2    | Reserved/flags               |
  | 8      | 4*n  | Key addresses (string)       |
  | 8+4*n  | 4*n  | Value tagged entries         |
  ```

### 2.9 Digest and String Interning In-Depth
- String interning ensures:
  - String equality checking is O(1) (address comparison)
  - No duplicate string storage (memory efficiency)
  - Fast symbol lookups
- Internal structure:
  - SBP (String Base Pointer): Current allocation position
  - Strings stored sequentially in SEG_STRING
  - Hash table for fast lookup/deduplication
- String addition:
  ```typescript
  function add(str: string): number {
    // Check if already exists
    const hash = hashString(str);
    const existingAddr = lookupString(hash, str);
    if (existingAddr !== 0) return existingAddr;
    
    // Allocate new space
    const requiredSpace = 1 + str.length; // 1 byte for length
    if (SBP + requiredSpace > STRING_SIZE) {
      throw new Error('String digest overflow');
    }
    
    // Store string length and characters
    const stringAddr = SBP;
    memory.write8(SEG_STRING, SBP++, str.length);
    for (let i = 0; i < str.length; i++) {
      memory.write8(SEG_STRING, SBP++, str.charCodeAt(i));
    }
    
    // Update hash table
    recordString(hash, stringAddr, str);
    return stringAddr;
  }
  ```
- String retrieval:
  ```typescript
  function get(address: number): string {
    const length = memory.read8(SEG_STRING, address);
    let result = '';
    for (let i = 0; i < length; i++) {
      result += String.fromCharCode(
        memory.read8(SEG_STRING, address + 1 + i)
      );
    }
    return result;
  }
  ```

### 2.10 Memory Safety Mechanisms
- Segmentation provides isolation between code, data and heap
- Bounds checking on every memory access
- Reference counting prevents use-after-free errors
- Copy-on-write ensures immutability guarantees
- Stack overflow detection on push operations
- Stack underflow detection on pop operations
- Type checking before operations (NaN-boxing)
- Heap block validation before dereferencing
- No direct pointer manipulation from Tacit code
- Strict error handling for memory violations

## 3. CORE COMPONENTS
- VM: {memory, stack, IP, returnStack, digest, symbolTable, compiler}
- Digest: String interning, deduplication
- SymbolTable: Linked-list of {key:number, value:Function, next}
- Compiler: {codeStream, CP, preserve, nestingScore}
- Tokenizer: {input, position, line, column, pushedBack:Token|null}
- Parser: {tokenizer, currentDefinition, insideCodeBlock}
- Interpreter: {vm, executor, execute(start) -> while(vm.running) loop}

## 4. EXECUTION FLOW
```
cli.ts → repl.ts/fileProcessor.ts → executor.ts → 
tokenizer → parser → interpreter.execute → vm.running loop → 
opcode dispatch → executeOp in builtins.ts
```

## 5. TOKENIZER (src/lang/tokenizer.ts)
- TokenType: NUMBER, WORD, STRING, SPECIAL, GROUP_START/END, BLOCK_START/END, WORD_QUOTE, EOF
- nextToken(): Identifies token type based on input position
- Multi-char tokens: "#[", "]#", ":[", "]:", "//" (comments)
- readWord(), readNumber(), readString(): extract specific token values
- pushBack(token), peekToken(): Backtracking and lookahead support
- Line/column tracking for error reporting

## 6. PARSER (src/lang/parser.ts)
- parse(tokenizer): Entry point, processes program tokens to bytecode
- processToken(token, state): Central dispatcher by TokenType
- Special handlers:
  - beginDefinition/endDefinition: Colon definitions (: word ... ;)
  - beginCodeBlock/parseCodeBlock: Parenthesized blocks
  - parseCurlyBlock: Modern control flow blocks
  - parseBacktickSymbol: Word quoting with backtick
- Compiles to bytecode via vm.compiler.compile8/16/Float32
- Control flow via branch patching (conditional/unconditional jumps)

## 7. SYMBOL RESOLUTION
- SymbolTable: Singly-linked list, newest definitions at head
- define(name, verb): Adds symbol→function mapping
- defineCall(name, address): Creates call function to address
- find(name): Lookups up symbol in list
- mark()/revert(): Checkpointing for temporary scoping
- No lexical scoping; global namespace

## 8. SYNTAX ELEMENTS
```
5 3 +                 # RPN arithmetic
: square dup * ;      # Word definition
(5 7 +) eval          # Code block with evaluation
[ 1 2 3 ]             # Vector literal
1 IF {10} ELSE {20}   # Modern control structures
#[ ... ]#             # Grouping notation
:[ ... ]:             # Dictionary literals
`symbol               # Symbol/word quoting
// comment            # C++-style comment
```

## 9. TYPE SYSTEM
- NaN-boxing in tagged.ts: All values in 32-bit float
- toTaggedValue(value, type): Encodes type+value in NaN pattern
- fromTaggedValue(num): Extracts {type, value, isHeap}
- Structure:
  ```
  |Sign|Exponent|NaN Bit|Type Tag|Mantissa Value|
  | 1  |   8    |   1   |    4   |      18      |
  ```
- VM operates exclusively on tagged values

## 10. HEAP MANAGEMENT
- Block-based allocation in 64-byte chunks
- Reference counting: addRef(), release()
- Copy-on-write implementation:
  ```typescript
  function vectorSet(vector, index, value) {
    if (vector.block.refCount > 1) {
      const newBlock = cloneBlock(vector.block);
      newBlock.data[index] = value;
      return { block: newBlock, length: vector.length };
    }
    vector.block.data[index] = value;
    return vector;
  }
  ```
- No garbage collection; deterministic cleanup

## 11. SEQUENCE ABSTRACTION
- Unified protocol for iteration: next() → {value, done}
- Types: VectorSequence, RangeSequence, StringSequence
- Operations: map, filter, reduce with lazy evaluation
- Implementation via tagged pointers to sequence state

## 12. IMPLEMENTATION GAPS
- Local variables (local-symbols.md): Not implemented
- Deferred execution (deferred.md): Partially implemented
- Cooperative multitasking (tasks.md): Not implemented
- Interface-based polymorphism (polymphism.md): Basic implementation only

## 13. RELEVANT FILES
- Core VM: src/core/{vm.ts, memory.ts, tagged.ts, compiler.ts}
- Language processing: src/lang/{tokenizer.ts, parser.ts, interpreter.ts}
- Operations: src/ops/{opcodes.ts, builtins.ts, define-builtins.ts}
- Memory management: src/heap/{block.ts, vector.ts}
- Strings: src/strings/{digest.ts, symbol-table.ts}
- Sequences: src/seq/{sequence.ts, range.ts}

## 14. FUTURE DIRECTIONS
- Tasks.md: Cooperative multitasking via explicit yield points
- Local-symbols.md: Lexical scoping with stack frames
- Polymphism.md: Interface-based method dispatch
- Memory-integrity.md: Enhanced NaN-boxing with interface bits
