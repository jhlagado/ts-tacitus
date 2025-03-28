# An In-Depth Exploration of the Tacit Language Architecture

## 1. Introduction

Tacit is a stack-based, concatenative programming language virtual machine (VM) implemented in TypeScript. Drawing inspiration from languages like Forth (stack manipulation, RPN, word definitions), APL/J (array/sequence processing emphasis), and functional languages like Clojure (immutability, structural sharing), Tacit aims to provide a powerful yet resource-efficient computing environment. Its architecture is meticulously designed for operation within highly constrained memory spaces, specifically targeting a 64KB memory footprint in its conceptual model, although the heap implementation cleverly extends the *addressable* range significantly.

This document delves into the intricate details of Tacit's architecture, examining its memory model, value representation, core data structures, execution lifecycle, and the underlying philosophies that shape its design. The analysis is based exclusively on the provided source code (`*.ts`, `*.js`, `*.mjs`) and documentation files (`*.md`).

## 2. Core Design Philosophy & Principles

Understanding Tacit's architecture requires grasping its foundational principles:

*   **Memory Efficiency:** The paramount goal is to operate effectively within tight memory limits (conceptually 64KB). This dictates choices like manual memory management, compact data representation, and efficient data structure implementations.
*   **Stack-Based Execution (RPN):** Following Forth's tradition, Tacit employs Reverse Polish Notation. Operations consume operands from a data stack and push results back. This simplifies parsing and function composition. Two stacks are used: one for data (`SP`) and one for return addresses/control flow (`RP`).
*   **Immutability & Structural Sharing:** Data structures, particularly vectors and potentially dictionaries/sequences derived from them, are immutable. Modifications do not alter the original structure but instead create new versions. To mitigate the cost of copying, Tacit implements **Copy-on-Write (CoW)** with **structural sharing**, heavily inspired by Clojure. Only the modified parts (and their ancestors in a linked structure) are cloned; unchanged parts are shared by reference.
*   **Reference Counting (No Garbage Collection):** Memory management relies on explicit reference counting for heap-allocated objects. This provides deterministic cleanup (objects are freed immediately when their reference count hits zero) and avoids the unpredictable pauses associated with traditional garbage collectors, which is advantageous in resource-constrained or real-time environments. However, it cannot handle cyclical references automatically.
*   **Block-Based Heap:** The heap is managed not as a contiguous free space but as a pool of fixed-size blocks (64 bytes). This eliminates external fragmentation entirely. Larger data structures are built by linking these blocks together.
*   **Tagged Values (NaN-Boxing):** A single 32-bit floating-point number format is used to represent all values. Type information and the actual value (or pointer) are encoded into the bit pattern of NaN (Not-a-Number) values. This allows for efficient storage and type checking without separate type fields.
*   **Sequence Abstraction:** Tacit features a powerful, unified abstraction for handling collections (ranges, vectors, strings, potentially external sources). Sequences emphasize lazy evaluation, processing elements on demand, which enhances memory efficiency by avoiding intermediate data structure materialization.
*   **Functional & Point-Free Style:** The language encourages a functional style, operating on sequences using higher-order functions (like `each`, `filter`, `reduce` - though implementation details vary). The RPN nature facilitates a tacit (point-free) style where function composition happens implicitly through juxtaposition.
*   **Bytecode Compilation:** Tacit code is not interpreted directly from source but compiled into a compact bytecode format for the VM to execute, enhancing performance.

## 3. Memory Architecture: The Foundation

The most defining characteristic of Tacit is its carefully crafted memory architecture, designed around the 64KB conceptual limit.

### 3.1. The 64KB Segmented Memory Space (`memory.ts`)

The VM operates on a flat, 64KB (`MEMORY_SIZE = 65536`) memory space represented by a `Uint8Array` buffer managed by the `Memory` class. This space is logically divided into fixed segments:

*   **`SEG_STACK` (0x0000 - 0x00FF, 256 bytes):** The primary data stack. Grows upwards. Managed by the Stack Pointer (`SP`). Holds `Float32` values (4 bytes each), limiting the practical depth.
*   **`SEG_RSTACK` (0x0100 - 0x01FF, 256 bytes):** The return stack. Used for storing return addresses during function calls (`callOp`, `evalOp`) and potentially for temporary storage by control structures or grouping operations (`groupLeftOp`). Managed by the Return Pointer (`RP`). Also holds `Float32` values.
*   **`SEG_STRING` (0x0200 - 0x09FF, 2KB):** Storage for interned strings managed by the `Digest` class. Strings are stored with a 1-byte length prefix (max 255 chars) followed by character codes.
*   **`SEG_CODE` (0x0A00 - 0x29FF, 8KB):** Stores the compiled bytecode generated by the `Compiler`. Managed by the Instruction Pointer (`IP`) during execution and the Compile Pointer (`CP`) during compilation.
*   **`SEG_HEAP` (0x2A00 - 0xFFFF, ~53.5KB):** The largest segment, dedicated to dynamic memory allocation managed by the `Heap` class. This is where complex data structures like vectors and dictionaries reside.

The `Memory` class provides low-level primitives (`read8`, `write8`, `read16`, `write16`, `readFloat`, `writeFloat`) that operate on specific segments and offsets, performing bounds checking against the total `MEMORY_SIZE`. The `resolveAddress` method translates a segment ID and offset into an absolute 16-bit address within the buffer.

### 3.2. The Block-Based Heap (`heap.ts`)

The `SEG_HEAP` is not managed using traditional `malloc`/`free` on arbitrary byte sizes. Instead, it's divided into fixed-size **blocks** of **`BLOCK_SIZE = 64` bytes**.

*   **Block Structure:** Each block reserves the first 4 bytes for metadata:
    *   **`BLOCK_NEXT` (Offset 0, 2 bytes):** Stores the *block index* (not byte offset) of the next block in a chain (used for multi-block structures or the free list). `INVALID` (0xFFFF) indicates the end of a chain.
    *   **`BLOCK_REFS` (Offset 2, 2 bytes):** The reference count for this block. A count of 0 means the block is free.
    *   **Usable Space:** This leaves `USABLE_BLOCK_SIZE = 60` bytes per block for actual data payload.

*   **Block-Based Addressing:** Instead of passing around 16-bit byte addresses within the heap, Tacit primarily uses 16-bit **block indices**. A block index `i` corresponds to the byte offset `i * BLOCK_SIZE` within the `SEG_HEAP`. This scheme has a profound implication: it allows the 16-bit value (stored within a tagged float) to address `2^16 = 65536` potential blocks. Since each block is 64 bytes, this effectively expands the *addressable heap space* to 65536 * 64 bytes = **4MB**, even though the *physical* heap segment is much smaller (~53.5KB in this configuration). The actual number of usable blocks is limited by `HEAP_SIZE / BLOCK_SIZE`. The `blockToByteOffset` method converts a block index to its physical byte offset within the heap segment.

*   **Free List Management:** The `Heap` class maintains a singly linked list (`freeList`) of available block indices.
    *   **Initialization:** On startup (`initializeFreeList`), all blocks within the heap segment are linked together using their `BLOCK_NEXT` fields, and their `BLOCK_REFS` are set to 0. The `freeList` pointer points to the index of the first free block.
    *   **Allocation (`malloc`):**
        1.  Calculates the number of blocks (`numBlocks`) required based on the requested `size` and `USABLE_BLOCK_SIZE`.
        2.  Traverses the `freeList` to find a contiguous sequence of `numBlocks`. *(Correction: The current `malloc` implementation seems to allocate potentially non-contiguous blocks individually and links them, rather than searching for a contiguous chunk in the free list. It requests blocks one by one until enough are acquired or the free list runs out).* It requests the *first* available block from the free list.
        3.  If successful, it removes the block(s) from the `freeList`.
        4.  Sets `BLOCK_REFS` to 1 for the allocated block(s).
        5.  If multiple blocks are needed for a single logical allocation (size > `USABLE_BLOCK_SIZE`), they are linked together using `BLOCK_NEXT`. The `malloc` function calculates how many blocks are needed and attempts to allocate them, linking them sequentially.
        6.  Returns the *block index* of the first allocated block (or `INVALID` if allocation fails).
    *   **Freeing (`decrementRef`, `addToFreeList`):**
        1.  `free` is simply an alias for `decrementRef`.
        2.  `decrementRef` takes a block index. It decrements the block's `BLOCK_REFS` count.
        3.  If the count reaches 0:
            *   It recursively calls `decrementRef` on the block pointed to by `BLOCK_NEXT` (to handle freeing multi-block structures).
            *   It then adds the now-free block back to the head of the `freeList` using `addToFreeList`.

*   **Reference Counting Functions:**
    *   `incrementRef(blockIndex)`: Increases the `BLOCK_REFS` count of the specified block. Used when a reference to a block is duplicated (e.g., pushed onto the stack, stored in another structure).
    *   `decrementRef(blockIndex)`: Decreases the count, potentially freeing the block (and subsequent blocks in a chain) if the count hits zero. Used when a reference is discarded (e.g., popped from the stack, overwritten).
    *   `setNextBlock(parent, child)`: Safely updates the `BLOCK_NEXT` pointer of the `parent` block to point to the `child` block, handling the necessary `incrementRef` on the new child and `decrementRef` on the old child.

*   **Copy-on-Write Support:**
    *   `cloneBlock(blockIndex)`: Allocates a new block, copies the *entire* 64-byte content (including header) from the original block to the new one, sets the new block's ref count to 1, and importantly, *increments the reference count* of the block originally pointed to by the old block's `BLOCK_NEXT` (as the new block now also shares that subsequent chain). Returns the index of the new block.
    *   `copyOnWrite(blockIndex, prevBlockIndex?)`: This is the core CoW function. It checks the reference count (`BLOCK_REFS`) of `blockIndex`. If the count is greater than 1 (meaning the block is shared), it calls `cloneBlock` to create a private copy. If a `prevBlockIndex` is provided (for multi-block structures), it updates the `BLOCK_NEXT` pointer of the previous block to point to the newly cloned block. If the ref count was 1, it simply returns the original `blockIndex` as no copy is needed.

This block-based, reference-counted heap with block-index addressing and CoW support is the cornerstone of Tacit's memory efficiency and immutable data structure implementation.

### 3.3. String Management (`digest.ts`)

Strings are stored in the dedicated `SEG_STRING`. The `Digest` class manages this segment.

*   **Storage Format:** Each string is stored with a 1-byte header indicating its length (maximum 255 characters), followed by the raw character codes.
*   **Allocation (`add`):** Appends the length byte and character data to the current end of the string segment, advancing the String Buffer Pointer (`SBP`). Throws errors if the string is too long or if the segment runs out of space. Returns the starting address (offset within `SEG_STRING`) of the newly added string.
*   **Lookup (`get`, `length`):** Retrieves the string or its length given its starting address.
*   **Interning (`find`, `intern`):** The `find` method searches the digest for an existing identical string. `intern` uses `find`; if the string already exists, it returns the existing address; otherwise, it calls `add` to store the new string and returns its address. This ensures that identical string literals only occupy memory once.

## 4. Value Representation: NaN-Boxing (`tagged.ts`)

Instead of using separate memory locations for type tags and values, Tacit employs **NaN-boxing**. All values manipulated by the VM (on the stack, in data structures) are represented as standard IEEE 754 32-bit floating-point numbers.

*   **The NaN Space:** IEEE 754 floats have specific bit patterns representing NaN (Not-a-Number). Crucially, there isn't just one NaN pattern; many patterns are valid NaNs. Tacit leverages this by using specific NaN patterns to encode type information and a payload (value or pointer).
*   **Encoding Scheme:**
    *   A value is considered "tagged" if it's a NaN. Normal floating-point numbers are treated directly as `CoreTag.NUMBER`.
    *   If a value *is* NaN, its 32 bits are interpreted as follows (based on `toTaggedValue` and `fromTaggedValue`):
        *   **Sign Bit (Bit 31):** Indicates Heap vs. Non-Heap. `1` = Heap-allocated object pointer, `0` = Core (primitive) value or pointer.
        *   **Exponent Bits (Bits 30-23):** Must be all `1`s (part of the NaN representation).
        *   **Quiet NaN Bit (Bit 22):** Must be `1` (part of the NaN representation). *(Note: The code uses `NAN_BIT = 1 << 22`, implying this bit is used, consistent with NaN requirements).*
        *   **Tag Bits (Bits 21-16):** A 6-bit field (`TAG_MANTISSA_MASK`) used to store the type tag. The specific interpretation depends on the Heap bit:
            *   If Heap Bit is `0`: Interpreted as `CoreTag` (INTEGER, CODE, STRING). `CoreTag.NUMBER` isn't stored via NaN-boxing.
            *   If Heap Bit is `1`: Interpreted as `HeapTag` (BLOCK, SEQ, VECTOR, DICT).
        *   **Value/Pointer Bits (Bits 15-0):** A 16-bit payload.
            *   For `CoreTag.INTEGER`: Stores a 16-bit *signed* integer (-32768 to 32767).
            *   For `CoreTag.CODE`: Stores a 16-bit *unsigned* bytecode address (offset in `SEG_CODE`).
            *   For `CoreTag.STRING`: Stores a 16-bit *unsigned* string address (offset in `SEG_STRING`).
            *   For `HeapTag.*`: Stores a 16-bit *unsigned* block index (within `SEG_HEAP`).

*   **Tags:**
    *   `CoreTag`: `NUMBER` (0, implicit, not NaN-boxed), `INTEGER` (1), `CODE` (2), `STRING` (3).
    *   `HeapTag`: `BLOCK` (0), `SEQ` (1), `VECTOR` (2), `DICT` (3).
    *   *(Note: The comments/docs sometimes mention NIL, NAN, VIEW tags which might be outdated or planned, but the `tagged.ts` code focuses on the tags listed above.)*
*   **`NIL` Value:** A specific constant (`NIL`) is defined as `toTaggedValue(0, false, CoreTag.INTEGER)`, representing a null or sentinel value, distinct from the number 0.
*   **Benefits:**
    *   **Memory Efficiency:** No need for separate type fields; everything fits in 4 bytes.
    *   **Speed:** Type checks can potentially be fast bitmask operations (though JS implementation might not fully realize this).
*   **Trade-offs:**
    *   Limits payload size (16 bits here).
    *   Complexity in encoding/decoding logic.
    *   JavaScript's number type doesn't map perfectly, potentially hiding some performance benefits.

Helper functions like `getTag`, `getValue`, `isHeapAllocated`, `isRefCounted`, `isNIL`, and `printNum` facilitate working with these tagged values.

## 5. Core Data Structures

Tacit's data structures are built upon the block-based heap and utilize tagged values and reference counting.

### 5.1. Vectors (`vector.ts`)

Vectors are the primary ordered collection type, designed for immutability via CoW.

*   **Representation:** A vector is represented by a tagged value (`HeapTag.VECTOR`) whose payload is the block index of the *first* block in a potentially linked chain.
*   **Block Layout:** Vector blocks reuse the standard 4-byte heap header (`BLOCK_NEXT`, `BLOCK_REFS`). The first block's payload contains additional vector-specific metadata *before* the element data:
    *   `VEC_SIZE` (Offset 4, 2 bytes): Stores the logical length (number of elements) of the vector.
    *   `VEC_RESERVED` (Offset 6, 2 bytes): Currently unused.
    *   `VEC_DATA` (Offset 8): The start of the element data within the block. Elements are stored as 32-bit tagged values (floats).
*   **Capacity:** Each block can store `capacityPerBlock = floor((60 - 4) / 4) = 14` elements after the vector metadata in the first block, and `floor(60 / 4) = 15` elements in subsequent blocks.
*   **Multi-Block Vectors:** For vectors exceeding the capacity of a single block, `vectorCreate` allocates additional blocks and links them using the `BLOCK_NEXT` pointers.
*   **Creation (`vectorCreate`):**
    1.  Calculates the number of blocks needed.
    2.  Allocates the required blocks using `heap.malloc`.
    3.  Writes the vector length (`VEC_SIZE`) into the first block.
    4.  Iterates through the input data, writing each element (as a 32-bit float/tagged value) sequentially into the allocated blocks, following the `BLOCK_NEXT` chain as needed.
    5.  Returns a tagged value (`HeapTag.VECTOR`) pointing to the first block index.
*   **Access (`vectorGet`):**
    1.  Reads the vector length from the first block's metadata. Checks for out-of-bounds index.
    2.  Calculates which block and which offset within that block the desired `index` corresponds to, considering `capacityPerBlock`.
    3.  Traverses the linked list of blocks using `heap.getNextBlock` until the correct block is reached.
    4.  Reads and returns the 32-bit float/tagged value from the calculated offset within that block.
*   **Update (`vectorUpdate`):**
    1.  Performs bounds checking.
    2.  Traverses the block chain to locate the target block containing the `index`. Keeps track of the `prevBlock`.
    3.  Crucially, calls `heap.copyOnWrite(currentBlock, prevBlock)` for the target block *before* writing. This ensures that if the block is shared (ref count > 1), a private copy is made, and the `prevBlock`'s `BLOCK_NEXT` is updated to point to the new copy. If the vector spans multiple blocks, CoW might only clone the single block being modified and potentially the path leading to it if structural sharing is fully implemented (though the current `vectorUpdate` seems to apply CoW only to the target block itself, relying on `copyOnWrite`'s `prevBlock` parameter to relink).
    4.  Writes the new `value` into the (potentially newly cloned) block at the correct offset.
    5.  Returns a tagged value pointing to the potentially new first block of the vector (if the first block itself was cloned).

### 5.2. Sequences (`sequence.ts`, `processor.ts`, `source.ts`, `sink.ts` - Conceptual)

Sequences are a more abstract concept, primarily described in documentation (`notes.md`, `sequences.md`). The provided code doesn't contain the full implementation (`sequence.ts`, etc. are missing), but the architecture suggests:

*   **Purpose:** Provide a unified, lazy interface for iterating over various data sources (ranges, vectors, strings) and applying transformations (map, filter, scan) without necessarily creating intermediate collections.
*   **Representation:** Likely represented by a tagged value (`HeapTag.SEQ`) pointing to a heap block containing sequence state.
*   **Sequence Block Layout (Conceptual, based on `notes.md`):**
    *   Standard Heap Header (`BLOCK_NEXT`, `BLOCK_REFS`).
    *   Parent Pointer: Tagged value pointing to the underlying data source (e.g., a vector, another sequence).
    *   Position/State: Current index or state information (e.g., `major position`, `total`, processor state).
    *   Slice View Pointer: Possibly for efficient sub-sequence access.
    *   Rank: For multi-dimensional concepts.
    *   Processor Fields: Flags and parameters (`PROC_FLAG`, `PROC_TYPE`, `PROC_PARAM`, `PROC_STATE`) to indicate if it's a transforming sequence (processor) and what kind.
*   **Lazy Evaluation:** The core idea is that elements are generated or transformed only when requested by a "sink" operation (like `reduce`, `toVector`, `forEach`).
*   **Iteration (`seqNext` - Conceptual):** A polymorphic function that, based on the sequence block's type (source or processor) and state, generates the *next* element or sub-sequence.
    *   For sources (e.g., `seqFromVector`), it reads the next element from the underlying vector.
    *   For ranges (`seqFromRange`), it calculates the next number.
    *   For processors (`map`, `filter`, `scan`), it calls `seqNext` on its *own* source sequence, applies the transformation logic (using `PROC_TYPE`, `PROC_PARAM`, `PROC_STATE`), and returns the result. `filter` might skip elements internally.
*   **Chaining:** Processors take a sequence as input and produce a new sequence, allowing pipelines like `source -> map -> filter -> sink`.

### 5.3. Dictionaries (`dict.ts`)

Dictionaries provide key-value mapping.

*   **Representation:** Implemented as a specialized vector (`HeapTag.DICT`), where the vector stores alternating key-value pairs. Keys are stored as tagged string pointers (`CoreTag.STRING`), and values are stored as tagged numbers. The vector is kept **sorted** lexicographically by key.
*   **Creation (`dictCreate`):**
    1.  Takes a flat array `[key1, value1, key2, value2, ...]`.
    2.  Validates input (even length, keys are strings, values are numbers).
    3.  Creates `[key, value]` pairs.
    4.  **Sorts** the pairs based on the string keys (`localeCompare`).
    5.  Flattens the sorted pairs back into an array, converting keys to tagged string pointers using `stringCreate` (which interns them via the `Digest`).
    6.  Creates a standard vector using `vectorCreate` with the flattened, sorted data.
    7.  **Re-tags** the resulting vector pointer from `HeapTag.VECTOR` to `HeapTag.DICT`.
*   **Access (`dictGet`):**
    1.  Takes the tagged dictionary pointer and the key string to find.
    2.  Leverages the sorted nature of the underlying vector to perform an efficient **binary search**.
    3.  In each step of the search, it reads a tagged key from the vector, gets the actual string from the `Digest`, and compares it (`localeCompare`) to the search key to narrow down the range.
    4.  If the key is found, it reads the corresponding value (stored immediately after the key in the vector) and returns it.
    5.  If the key is not found after the binary search, it returns `NIL`.

## 6. Execution Model & Virtual Machine (`vm.ts`, `interpreter.ts`)

Tacit executes programs using a classic stack-based VM.

*   **Dual Stacks:**
    *   **Data Stack:** (`SP`, `SEG_STACK`) Used for passing arguments to operations (words) and receiving results. Manipulated by most operations (`+`, `dup`, `swap`, etc.).
    *   **Return Stack:** (`RP`, `SEG_RSTACK`) Used primarily for control flow. Stores return addresses when `callOp` or `evalOp` is executed. `exitOp` pops an address from here to resume execution. Also used temporarily by `groupLeftOp`/`groupRightOp` and potentially other constructs.
*   **Instruction Pointer (`IP`):** A register (simple variable in `VM` class) holding the 16-bit address (offset within `SEG_CODE`) of the *next* bytecode instruction to be fetched and executed.
*   **Bytecode:** A sequence of single-byte opcodes (defined in `Op` enum) potentially followed by immediate operands (e.g., 16-bit offsets for branches, 32-bit floats for literals).
*   **Interpreter Loop (`execute` in `interpreter.ts`):**
    1.  The main execution entry point, given a starting bytecode address (`start`).
    2.  Sets `vm.IP = start` and `vm.running = true`.
    3.  Enters a `while (vm.running)` loop.
    4.  Inside the loop:
        *   Fetches the next opcode using `vm.next8()` (which reads from `SEG_CODE` at `vm.IP` and increments `IP`).
        *   Dispatches to the appropriate handler function based on the opcode (`executeOp` in `builtins.ts`).
        *   The handler function performs the operation, manipulating the stacks (`vm.push`, `vm.pop`, `vm.rpush`, `vm.rpop`) and potentially fetching immediate operands using `vm.next16()`, `vm.nextFloat()`.
        *   Control flow opcodes (`Branch`, `Call`, `Exit`, `Eval`) directly modify `vm.IP` or use the return stack.
        *   `abortOp` sets `vm.running = false`, terminating the loop.
    5.  Includes basic error handling, wrapping the `executeOp` call in a try-catch block.
    6.  Resets compiler state (`vm.compiler.reset()`) after execution finishes or errors out.

*   **Key Control Flow Opcodes:**
    *   `Op.Branch`: (`skipDefOp`) Reads a 16-bit relative offset and adds it to `IP`. Used to skip over the compiled code of colon definitions during normal execution flow.
    *   `Op.BranchCall`: (`skipBlockOp`) Reads a 16-bit relative offset. Pushes the *current* `IP` (address *after* the offset) onto the data stack as a tagged `CODE` pointer. Then adds the offset to `IP`. Used to compile code blocks `(...)` - pushes the block's code pointer onto the stack without executing it immediately.
    *   `Op.Call`: (`callOp`) Reads a 16-bit *absolute* address. Pushes the *current* `IP` (address *after* the address operand) onto the *return* stack (`rpush`). Sets `IP` to the read absolute address. Used to execute compiled colon definitions.
    *   `Op.Exit`: (`exitOp`) Pops a tagged `CODE` pointer from the *return* stack (`rpop`) and sets `IP` to its value. Used to return from a `Call`.
    *   `Op.Eval`: (`evalOp`) Pops a tagged `CODE` pointer from the *data* stack (`pop`). Pushes the *current* `IP` onto the *return* stack (`rpush`). Sets `IP` to the popped pointer's value. Used to execute a code block whose pointer is on the data stack.
    *   `Op.Abort`: (`abortOp`) Sets `vm.running = false`, stopping the interpreter loop.

## 7. Language Processing Pipeline

Tacit code goes through several stages before execution:

### 7.1. Tokenizer (`tokenizer.ts`)

*   **Input:** Raw Tacit source code string.
*   **Output:** A stream of `Token` objects (`{ type: TokenType, value: TokenValue, position: number }`).
*   **Process:**
    *   Iterates through the input character by character, tracking line and column numbers.
    *   Skips whitespace and full-line comments (`//`).
    *   Recognizes different `TokenType`s:
        *   `NUMBER`: Parses integers and floats (including signs).
        *   `STRING`: Parses double-quoted strings, handling standard escape sequences (`\n`, `\t`, `\"`, `\\`).
        *   `SPECIAL`: Recognizes single special characters defined in `isSpecialChar` (`(`, `)`, `:`, `"`, `'`, `` ` ``). *(Note: The parser later handles `:` and `;` distinctly)*. Also handles specific grouping chars `{}[]` as `WORD` for now.
        *   `WORD`: Parses sequences of non-whitespace, non-special characters. Can include operators (`+`, `*`), names (`dup`, `myWord`), or even number-like identifiers (`123name`).
    *   Provides `nextToken()` to get the next token and `pushBack()` to undo reading one token.

### 7.2. Parser (`parser.ts`)

*   **Input:** A `Tokenizer` instance.
*   **Output:** Emits bytecode into the `SEG_CODE` via the `Compiler`. Updates the `SymbolTable`.
*   **Process:**
    *   Resets the compiler (`vm.compiler.reset()`).
    *   Reads tokens one by one from the tokenizer.
    *   **State Management:** Tracks whether it's currently inside a colon definition (`currentDefinition`) or a code block (`insideCodeBlock`).
    *   **Token Handling (`processToken`):**
        *   `NUMBER`: Compiles `Op.LiteralNumber` followed by the 32-bit float value (`compiler.compileFloat`).
        *   `STRING`: Compiles `Op.LiteralString`. Adds the string to the `Digest` (`vm.digest.add`) to get its address, then compiles the 16-bit address (`compiler.compile16`).
        *   `WORD`: Looks up the word in the `SymbolTable` (`vm.symbolTable.find`).
            *   If found, calls the associated `Verb` function. For built-in words like `+` or `dup`, the `Verb` directly calls `vm.compiler.compile8(OpCode)`. For user-defined words (from colon definitions), the `Verb` (created by `defineCall`) compiles `Op.Call` followed by the word's bytecode address (`compiler.compile16`).
            *   If not found, throws an "Unknown word" error.
        *   `SPECIAL`: Handles structural tokens:
            *   `:`: Starts a colon definition.
                *   Checks for nesting errors.
                *   Reads the definition name (must be `WORD` or `NUMBER`).
                *   Compiles a forward `Op.Branch` with a placeholder offset.
                *   Records the definition's start address.
                *   Calls `symbolTable.defineCall` to create a `Verb` that compiles an `Op.Call` to the start address.
                *   Sets `currentDefinition` state and `compiler.preserve = true`.
            *   `;`: Ends a colon definition.
                *   Checks if inside a definition.
                *   Compiles `Op.Exit`.
                *   **Patches** the offset of the `Op.Branch` compiled by `:` to jump *past* the just-compiled definition body.
                *   Clears `currentDefinition` state.
            *   `(`: Starts a code block (`parseBlock`).
                *   Sets `compiler.preserve = true` (code blocks are typically stored).
                *   Increments nesting counter.
                *   Compiles `Op.BranchCall` with a placeholder offset.
                *   Recursively calls `processToken` for tokens within the block until `)` is found.
                *   Compiles `Op.Exit`.
                *   **Patches** the `Op.BranchCall` offset to point *past* the block's code.
                *   Decrements nesting counter.
            *   `)`: Should be consumed by `parseBlock`. If encountered outside, throws "Unexpected closing parenthesis".
            *   `` ` ``: Parses the following non-whitespace/non-grouping characters as a symbol literal, interns it using `digest.add`, and compiles `Op.LiteralString` followed by the string address. *(Note: Treats symbols like strings)*.
    *   Adds `Op.Abort` at the very end of compilation.

### 7.3. Compiler (`compiler.ts`)

*   **Purpose:** Provides methods to append bytecode and immediate operands to the `SEG_CODE`.
*   **State:**
    *   `CP` (Compile Pointer): The 16-bit offset in `SEG_CODE` where the *next* byte will be written.
    *   `BP` (Buffer Pointer): The starting offset for the current compilation unit. `reset()` usually sets `CP = BP`.
    *   `preserve`: A boolean flag. If true, `reset()` sets `BP = CP`, effectively preserving the just-compiled code (used for definitions and blocks). If false, `reset()` sets `CP = BP`, allowing the code buffer to be reused (typical for REPL lines).
*   **Methods:**
    *   `compile8(value)`: Writes a single byte.
    *   `compile16(value)`: Writes a 16-bit integer (handling signedness correctly for storage).
    *   `compileFloat(value)`: Writes a 32-bit float (handles tagged values implicitly).
    *   `compileAddress(value)`: Takes a 16-bit address, tags it as `CoreTag.CODE`, and writes it as a 32-bit float using `compileFloat`.

### 7.4. Symbol Table (`symbol-table.ts`)

*   **Purpose:** Manages the dictionary of defined words (operations). Maps word names (strings) to `Verb` functions.
*   **Representation:** A singly linked list of `SymbolTableNode`s (`{ key: number, value: Verb, next: SymbolTableNode | null }`). The `key` is the address of the word's name string in the `Digest`. Using a linked list allows easy shadowing (newer definitions are added to the head and found first).
*   **Methods:**
    *   `define(name, verb)`: Adds or overrides a word definition. Interns the `name` using `digest.add` to get the key, creates a new node, and prepends it to the linked list.
    *   `defineCall(name, address)`: A specialized version of `define`. It creates a `Verb` closure (`compileCall`) that, when invoked by the parser, compiles an `Op.Call` instruction followed by the provided bytecode `address`. This is how user-defined words are linked.
    *   `find(name)`: Traverses the linked list, comparing the `Digest` string at each node's `key` with the provided `name`. Returns the `Verb` of the first match found (most recent definition) or `undefined`.
*   **Initialization:** The constructor calls `defineBuiltins`, which populates the table with the core language operations, mapping operator strings (`+`, `dup`, etc.) or word names (`eval`, `abs`) to `Verb` functions that compile the corresponding opcode.

## 8. Tooling and Environment

*   **CLI (`cli.ts`):** The main command-line entry point. Parses arguments (`--no-interactive`), identifies files to process, and decides whether to run `processFiles` or start the `startREPL`.
*   **File Processor (`fileProcessor.ts`):**
    *   `processFile`: Reads a `.tacit` file, splits it into lines, trims whitespace, skips empty lines and comments, and calls `executeLine` for each valid line. Handles file reading and execution errors.
    *   `processFiles`: Initializes the interpreter (`setupInterpreter`), iterates through a list of files calling `processFileFn` (defaults to `processFile`), and optionally exits on the first error.
*   **REPL (`repl.ts`):**
    *   Uses Node.js `readline` for interactive input.
    *   Optionally processes initial files using `processFile`.
    *   Enters a loop: prompts the user (`> `), reads a line, executes it using `executeLine`.
    *   Handles special commands: `exit` (closes REPL) and `load <filepath>` (calls `processFile` on the specified file).
    *   Catches errors from `executeLine` and prints them without exiting the REPL.
*   **Testing (`*.test.ts`, `jest.config.js`):** Uses Jest and `ts-jest` for unit and integration testing of core components (VM, parser, tokenizer, heap, operations, etc.). Aims for reasonable code coverage.
*   **Linting (`eslint.config.mjs`):** Uses ESLint with TypeScript support for code style and quality checks.

## 9. Conclusion

The Tacit architecture represents a thoughtful and intricate design aimed squarely at achieving functional programming capabilities within a highly memory-constrained, stack-based environment. Its core strengths lie in:

*   **Memory Efficiency:** The segmented memory, block-based heap, reference counting, NaN-boxing, and lazy sequences all contribute to minimizing memory usage.
*   **Deterministic Performance:** The absence of a traditional GC avoids unpredictable pauses.
*   **Immutability:** CoW with structural sharing provides the benefits of immutability without excessive copying overhead.
*   **Novel Addressing:** The block-index addressing scheme cleverly expands the *logical* heap address space far beyond the physical 16-bit limit.
*   **Unified Value System:** NaN-boxing allows diverse types (numbers, pointers, integers) to be handled uniformly on the stack and in data structures.

However, the design also implies certain trade-offs:

*   **Complexity:** The custom memory management, NaN-boxing, and CoW logic add significant implementation complexity compared to relying on a host language's runtime.
*   **Reference Counting Limitations:** Cannot automatically handle cyclic data structures, potentially leading to memory leaks if not managed carefully by the programmer or higher-level abstractions.
*   **Performance Overhead:** While avoiding GC pauses, reference counting itself incurs overhead on assignments and scope exits. NaN-boxing/unboxing also adds overhead. The performance in the target C/assembly environment would differ significantly from the TypeScript prototype.

Overall, Tacit, as presented in the provided files, is a sophisticated VM prototype showcasing how principles from stack languages, array languages, and functional programming can be synthesized into a unique architecture optimized for resource-limited systems. Its detailed memory management and value representation schemes are particularly noteworthy design elements.