# Buffer (LIST‑backed Ring Buffer)

## Design Philosophy

**LIST is ONLY for memory allocation** — once allocated, we ignore LIST semantics and treat the buffer as a **raw memory block with array semantics**:

- Index 0 is at the **lowest address** (furthest from TOS)
- Index N-1 is at the **highest address** (closest to TOS)
- This is the opposite of LIST semantics (which are TOS-facing)

## Layout

For a buffer with capacity `N` elements:

- **Total slots**: `N + 3` (header + readPtr + writePtr + N data slots)
- **Header**: `LIST:(N+2)` at TOS (SP) — **used only for allocation**
- **Payload layout** (once allocated, treat as raw memory with address-increasing order):
  - `readPtr` **cell** at `headerCell - 1` (absolute address of storage location; stores logical index 0..N-1)
  - `writePtr` **cell** at `headerCell - 2` (absolute address of storage location; stores logical index 0..N-1)
  - Data base address: `dataBase = headerCell - (N + 2)` (lowest address)
  - `data[0]` at `dataBase` (lowest address, index 0)
  - `data[1]` at `dataBase + 1` (address increases)
  - ...
  - `data[N-1]` at `dataBase + (N-1)` (highest data address, index N-1)

## Memory Addressing Example

If `SP = 100` and we allocate a 13-slot buffer (N=10 elements):

```
Absolute Address | Content        | Logical Index | Note
----------------|----------------|---------------|------------------
100             | LIST:12        | Header        | TOS (SP) - anchor for addressing
99              | readPtr        | Metadata      | Stores logical index (initially 0, points to data[0])
98              | writePtr       | Metadata      | Stores logical index (initially 0, points to data[0])
97              | data[9]        | Index 9       | Highest address (address-increasing order)
96              | data[8]        | Index 8       |
95              | data[7]        | Index 7       |
94              | data[6]        | Index 6       |
93              | data[5]        | Index 5       |
92              | data[4]        | Index 4       |
91              | data[3]        | Index 3       |
90              | data[2]        | Index 2       |
89              | data[1]        | Index 1       |
88              | data[0]        | Index 0       | Lowest data address
```

**Key points**:

- **Address-increasing order**: Addresses go UP as indices increase
- `data[0]` at address 88 (lowest), `data[9]` at address 97 (highest)
- Sequential reads from address 88 upward: data[0], data[1], ..., data[9] in correct order
- Perfect for text buffers: "hello" stored as 'h' at data[0] (88), 'e' at data[1] (89), 'l' at data[2] (90), 'l' at data[3] (91), 'o' at data[4] (92)
- Formula: `data[i]` = `headerCell - (N + 2) + i` = `dataBase + i` where `dataBase = headerCell - (N + 2)`

## Initial State

- `readPtr = 0` (points to `data[0]`, the next element to read)
- `writePtr = 0` (points to `data[0]`, the next slot to write)
- **No initialization needed** - data only exists between the pointers, which are equal at start (empty buffer)
- Buffer is empty when `readPtr == writePtr`

## Pointer Semantics

- **Write pointer**: Used for **stack semantics** (write/unwrite operations)
  - `write`: write to `data[writePtr]`, then `writePtr = (writePtr + 1) % N` (increment, append)
  - `unwrite`: `writePtr = (writePtr - 1 + N) % N` (decrement, prepend), then read from `data[writePtr]`
- **Read pointer**: Used for **queue semantics** or other read patterns
  - `read`: read from `data[readPtr]`, then `readPtr = (readPtr + 1) % N` (increment, append)
  - `unread`: `readPtr = (readPtr - 1 + N) % N` (decrement), then write `x` to `data[readPtr]` — useful for tokenizer pushback

## Operations

**Input validation**: All buffer operations (except `buffer`) accept either a LIST header or a REF. Use `getListBounds(vm, value)` to resolve polymorphically. If it returns `null`, throw `Error("Expected buffer (LIST or REF)")`.

**Extracting capacity**: After resolving the buffer, extract capacity `N` from the LIST header: `N = getListLength(header) - 2` (header stores `N+2` payload slots: readPtr + writePtr + N data slots).

### `buffer` (creation)

- **Stack**: `( N -- buffer )`
- **Behavior**: Allocates a LIST with `N + 3` total slots (header + readPtr + writePtr + N data slots)
  - Creates `LIST:(N+2)` header at TOS (SP)
  - Initializes `readPtr = 0` at `SP-1`
  - Initializes `writePtr = 0` at `SP-2`
  - Data slots are not initialized (only data between pointers matters)
  - Returns the buffer (LIST header) on the stack
- **Memory access**:
  - Allocate LIST with `N + 2` payload slots
  - Write `readPtr = 0` to `SP-1`
  - Write `writePtr = 0` to `SP-2`
- **Errors**: Throws if `N < 1` or `N` is too large for available memory

### `write` (stack operation - write)

- **Stack**: `( buffer/ref x -- )`
- **Aliases**: `push` (for familiarity with stack terminology)
- **Note**: Consumes both inputs (buffer is typically stored in a local/global)
- **Behavior** (stack semantics using write pointer):
  - Read `writePtr` (logical index 0..N-1) from `headerCell - 2`
  - Read `readPtr` (logical index 0..N-1) from `headerCell - 1` (for full check)
  - Calculate `dataBase = headerCell - (N + 2)` (needed because pointers are relative, not absolute)
  - If full (`(writePtr + 1) % N == readPtr`), **throw error**
  - Otherwise:
    1. Write `x` to `data[writePtr]` at absolute address `dataBase + writePtr`
    2. `writePtr = (writePtr + 1) % N` (increment, wrap around if needed)
    3. Write updated `writePtr` (still a logical index) back to `headerCell - 2`
- **Memory access**:
  - Read pointers: `writePtr = vm.memory.readCell(headerCell - 2)`, `readPtr = vm.memory.readCell(headerCell - 1)`
  - Calculate base: `dataBase = headerCell - (N + 2)`
  - Write data: `vm.memory.writeCell(dataBase + writePtr, x)`
  - Update pointer: `vm.memory.writeCell(headerCell - 2, newWritePtr)`

### `unwrite` (stack operation - unwrite)

- **Stack**: `( buffer/ref -- v )`
- **Aliases**: `pop` (for familiarity with stack terminology)
- **Note**: Consumes buffer input, returns the value
- **Behavior** (stack semantics using write pointer):
  - Read `writePtr` from `headerCell - 2`
  - Read `readPtr` from `headerCell - 1` (for empty check)
  - Calculate `dataBase = headerCell - (N + 2)`
  - If empty (`writePtr == readPtr`), **throw error**
  - Otherwise:
    1. `writePtr = (writePtr - 1 + N) % N` (decrement, prepend direction)
    2. Read `data[writePtr]` from absolute address `dataBase + writePtr`
    3. Write updated `writePtr` back to `headerCell - 2`
    4. Return value
- **Memory access**:
  - Read pointers: `writePtr = vm.memory.readCell(headerCell - 2)`, `readPtr = vm.memory.readCell(headerCell - 1)`
  - Calculate base: `dataBase = headerCell - (N + 2)`
  - Update pointer: `vm.memory.writeCell(headerCell - 2, newWritePtr)`
  - Read data: `value = vm.memory.readCell(dataBase + newWritePtr)`

### `read` (queue operation - read from read pointer)

- **Stack**: `( buffer/ref -- v )`
- **Aliases**: `shift` (for familiarity with array terminology)
- **Note**: Consumes buffer input, returns the value
- **Behavior** (queue semantics using read pointer):
  - Read `readPtr` from `headerCell - 1`
  - Read `writePtr` from `headerCell - 2` (for empty check)
  - Calculate `dataBase = headerCell - (N + 2)`
  - If empty (`readPtr == writePtr`), **throw error**
  - Otherwise:
    1. Read `data[readPtr]` from absolute address `dataBase + readPtr`
    2. `readPtr = (readPtr + 1) % N` (increment, append direction)
    3. Write updated `readPtr` back to `headerCell - 1`
    4. Return value
- **Memory access**:
  - Read pointers: `readPtr = vm.memory.readCell(headerCell - 1)`, `writePtr = vm.memory.readCell(headerCell - 2)`
  - Calculate base: `dataBase = headerCell - (N + 2)`
  - Read data: `value = vm.memory.readCell(dataBase + readPtr)`
  - Update pointer: `vm.memory.writeCell(headerCell - 1, newReadPtr)`

### `unread` (queue operation - push back value)

- **Stack**: `( buffer/ref x -- )`
- **Aliases**: `unshift` (for familiarity with array terminology)
- **Note**: Consumes both inputs (similar to pushing back into input stream in a tokenizer)
- **Behavior** (push value back into buffer):
  - Read `readPtr` from `headerCell - 1`
  - Read `writePtr` from `headerCell - 2` (for full check)
  - Calculate `dataBase = headerCell - (N + 2)`
  - If buffer is full (`(readPtr - 1 + N) % N == writePtr`), **throw error**
  - Otherwise:
    1. `readPtr = (readPtr - 1 + N) % N` (decrement, undo append direction)
    2. Write `x` to `data[readPtr]` at absolute address `dataBase + readPtr`
    3. Write updated `readPtr` back to `headerCell - 1`
- **Memory access**:
  - Read pointers: `readPtr = vm.memory.readCell(headerCell - 1)`, `writePtr = vm.memory.readCell(headerCell - 2)`
  - Calculate base: `dataBase = headerCell - (N + 2)`
  - Update pointer: `readPtr = (readPtr - 1 + N) % N`
  - Write data: `vm.memory.writeCell(dataBase + readPtr, x)`
  - Update pointer: `vm.memory.writeCell(headerCell - 1, newReadPtr)`

### Query Operations

- `buf-size`: `( buffer/ref -- n )`
  - **Note**: Consumes buffer input, returns size
  - Read `readPtr` from `headerCell - 1`, `writePtr` from `headerCell - 2`
  - Returns `(writePtr - readPtr + N) % N`
- `is-empty`: `( buffer/ref -- 0|1 )`
  - **Note**: Consumes buffer input, returns boolean (0=false, 1=true)
  - Read `readPtr` from `headerCell - 1`, `writePtr` from `headerCell - 2`
  - Returns `1` if `readPtr == writePtr`, else `0`
- `is-full`: `( buffer/ref -- 0|1 )`
  - **Note**: Consumes buffer input, returns boolean (0=false, 1=true)
  - Read `readPtr` from `headerCell - 1`, `writePtr` from `headerCell - 2`
  - Returns `1` if `(writePtr + 1) % N == readPtr`, else `0`

## Error Handling

**Strict throwing exceptions** for overflow/underflow:

- `write` on full buffer → throw `Error("Buffer overflow")`
- `unwrite` on empty buffer → throw `Error("Buffer underflow")`
- `read` on empty buffer → throw `Error("Buffer underflow")`
- `unread` on full buffer → throw `Error("Buffer full, cannot unread")`

## Implementation Notes

1. **Memory access**: Use `vm.memory.readCell(cellIndex)` and `vm.memory.writeCell(cellIndex, value)` with **absolute cell indices**, not `slot`/`fetch`/`store`.

2. **Address calculation** (address-increasing data layout):
   - Buffer header at `headerCell` (absolute address)
   - `readPtr` cell = `headerCell - 1` (stores index 0..N-1)
   - `writePtr` cell = `headerCell - 2` (stores index 0..N-1)
   - Data base address: `dataBase = headerCell - (N + 2)` (lowest address)
   - `data[i]` cell = `dataBase + i` = `headerCell - (N + 2) + i` where `i` is the logical index (0..N-1)
   - Example with N=10, headerCell=100: `dataBase = 100 - 12 = 88`, so `data[0]` = 88, `data[1]` = 89, ..., `data[9]` = 97

3. **Pointer values**: Pointers store **logical indices** (0..N-1), not absolute addresses. To access the data:
   - Read pointer value: `readPtrValue = vm.memory.readCell(headerCell - 1)`
   - Calculate data base: `dataBase = headerCell - (N + 2)`
   - Access data: `data[readPtrValue]` = `vm.memory.readCell(dataBase + readPtrValue)`

   **Why relative (logical indices) instead of absolute addresses?**

   **Relative pointers (current design - logical indices 0..N-1):**
   - ✅ **Simple wraparound**: `(writePtr + 1) % N` — no need to convert back to index
   - ✅ **Portable**: Works if buffer moves in memory (though buffers don't move in Tacit)
   - ✅ **Small values**: Pointers fit in small integer range (0..N-1)
   - ✅ **Clear semantics**: Pointer value directly represents logical position
   - ❌ **Calculation overhead**: Must compute `dataBase = headerCell - (N + 2)` on every operation

   **Absolute pointers (alternative - store absolute cell addresses):**
   - ✅ **Direct access**: `vm.memory.readCell(writePtr)` — no calculation needed
   - ✅ **Potentially faster**: One less arithmetic operation per access
   - ❌ **Complex wraparound**: Must convert to index, wrap, convert back: `writePtr = ((writePtr - dataBase) + 1) % N + dataBase`
   - ❌ **Larger values**: Pointers are absolute addresses (larger integers)
   - ❌ **Less clear**: Pointer value doesn't directly represent logical position

   **Decision**: Use **relative pointers (logical indices)** because:
   - Wraparound logic is simpler and more readable
   - The `dataBase` calculation (`headerCell - (N + 2)`) is a single subtraction
   - Logical indices make the code more maintainable
   - The performance difference is negligible (one subtraction vs. direct access)

4. **LIST header**: The `LIST:(N+2)` header is created for allocation purposes only. Once allocated, buffer operations ignore LIST semantics and use direct memory access.

5. **Polymorphic input handling** (REFs are automatically dereferenced):
   - All buffer operations accept either a **LIST header** (on stack) or a **REF** (to a LIST header)
   - Use `getListBounds(vm, value)` to resolve the input polymorphically:
     - If input is a LIST tag: returns `{ header, baseCell, headerCell }` where `headerCell = vm.sp - 1`
     - If input is a REF: automatically dereferences to get the absolute cell address of the LIST header
     - If input is neither LIST nor REF: returns `null` → **throw error** (`"Expected buffer (LIST or REF)"`)
   - Once resolved, use the same address calculations for both cases (polymorphic model)
   - **In practice, REFs will be used 99% of the time** (buffers stored in locals/globals)
   - This allows all operations to work equally well with LIST headers or REFs without separate code paths

## Example Usage

**Stack operations** (using write pointer):

```
10 buffer var buf    \ Allocate 10-element buffer, store in local buf
&buf 42 write        \ Write 42 (consumes &buf and 42, writes to data[0], writePtr becomes 1)
&buf 43 write        \ Write 43 (consumes &buf and 43, writes to data[1], writePtr becomes 2)
&buf unwrite         \ Unwrite (consumes &buf, writePtr becomes 1, returns data[1]=43)
&buf unwrite         \ Unwrite (consumes &buf, writePtr becomes 0, returns data[0]=42)
```

**Using aliases** (push/pop/shift/unshift following JavaScript array terminology):

```
&buf 42 push         \ Alias for write (consumes &buf and 42)
&buf pop             \ Alias for unwrite (consumes &buf, returns value)
&buf shift           \ Alias for read (consumes &buf, returns value)
&buf 100 unshift     \ Alias for unread (consumes &buf and 100)
```

**Queue operations** (using read pointer for reading, write pointer for writing):

```
&buf 100 write       \ Write 100 (consumes &buf and 100, writes to data[0], writePtr becomes 1)
&buf 101 write       \ Write 101 (consumes &buf and 101, writes to data[1], writePtr becomes 2)
&buf read            \ Read (consumes &buf, reads data[0]=100, readPtr becomes 1)
&buf 100 unread      \ Unread (consumes &buf and 100, readPtr becomes 0, writes 100 back)
&buf read            \ Read again (consumes &buf, reads data[0]=100, readPtr becomes 1)
&buf read            \ Read (consumes &buf, reads data[1]=101, readPtr becomes 2)
```

**Query operations**:

```
&buf buf-size        \ Consumes &buf, returns current size
&buf is-empty        \ Consumes &buf, returns 1 if empty, else 0
&buf is-full         \ Consumes &buf, returns 1 if full, else 0
```

## Use Cases

- Text buffers: sequential character storage with address-increasing order
- Traversal stacks: bounded LIFO storage
- Token queues: FIFO storage with separate read/write pointers
- Sliding windows: fixed-capacity rolling history
