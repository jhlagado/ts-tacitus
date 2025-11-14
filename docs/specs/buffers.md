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
  - `readPtr` **cell** at `headerCell - 1` (absolute address of storage location; stores a logical counter, initialised to 0)
  - `writePtr` **cell** at `headerCell - 2` (absolute address of storage location; stores a logical counter, initialised to 0)
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

- **Logical counters**: `writePtr` and `readPtr` are monotonically updated integers. They are not confined to `0..N-1`; instead, the effective slot is computed with `index = ((ptr % N) + N) % N` whenever data is read or written.
- **Write pointer** (stack-style operations):
  - `write`: write to `data[index(writePtr)]`, then increment `writePtr += 1` (append direction).
  - `unwrite`: decrement `writePtr -= 1`, then read from `data[index(writePtr)]` (prepend direction).
- **Read pointer** (queue-style operations):
  - `read`: read from `data[index(readPtr)]`, then increment `readPtr += 1`.
  - `unread`: decrement `readPtr -= 1`, then write `x` to `data[index(readPtr)]` (useful for tokenizer pushback).
- **Size & guards**: Buffer occupancy is `size = writePtr - readPtr`. Strict overflow/underflow checks ensure `0 ≤ size ≤ N`, so the physical slot computation always lands inside the data window.

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

- **Stack**: `( x buffer/ref -- )`
- **Aliases**: `push` (for familiarity with stack terminology)
- **Note**: Consumes both inputs (buffer is typically stored in a local/global)
- **Behavior** (stack semantics using write pointer):
  - Read `writePtr` from `headerCell - 2`.
  - Read `readPtr` from `headerCell - 1` for the capacity guard (`writePtr - readPtr === N` ⇒ **throw error**).
  - Calculate `dataBase = headerCell - (N + 2)`.
  - Compute `slot = ((writePtr % N) + N) % N`.
  - Otherwise:
    1. Write `x` to `data[slot]` at absolute address `dataBase + slot`.
    2. Increment logical pointer: `writePtr += 1`.
    3. Store updated `writePtr` back to `headerCell - 2`.
- **Memory access**:
  - Read pointers: `writePtr = vm.memory.readCell(headerCell - 2)`, `readPtr = vm.memory.readCell(headerCell - 1)`.
  - Calculate base: `dataBase = headerCell - (N + 2)`.
  - Write data: `vm.memory.writeCell(dataBase + slot, x)`.
  - Update pointer: `vm.memory.writeCell(headerCell - 2, writePtr + 1)`.

### `unwrite` (stack operation - unwrite)

- **Stack**: `( buffer/ref -- v )`
- **Aliases**: `pop` (for familiarity with stack terminology)
- **Note**: Consumes buffer input, returns the value
- **Behavior** (stack semantics using write pointer):
  - Read `writePtr` and `readPtr`; if they are equal, the buffer is empty ⇒ **throw error**.
  - Set `nextWritePtr = writePtr - 1`.
  - Calculate `dataBase = headerCell - (N + 2)` and `slot = ((nextWritePtr % N) + N) % N`.
  - Read the value from `dataBase + slot`.
  - Store `nextWritePtr` back to `headerCell - 2`.
- **Memory access**:
  - Read pointers: `writePtr = vm.memory.readCell(headerCell - 2)`, `readPtr = vm.memory.readCell(headerCell - 1)`.
  - Write pointer: `vm.memory.writeCell(headerCell - 2, nextWritePtr)`.
  - Read data: `value = vm.memory.readCell(dataBase + slot)`.

### `read` (queue operation - read from read pointer)

- **Stack**: `( buffer/ref -- v )`
- **Aliases**: `shift` (for familiarity with array terminology)
- **Note**: Consumes buffer input, returns the value
- **Behavior** (queue semantics using read pointer):
  - Read `readPtr` and `writePtr`; if equal, the buffer is empty ⇒ **throw error**.
  - Calculate `dataBase = headerCell - (N + 2)` and `slot = ((readPtr % N) + N) % N`.
  - Read the value from `dataBase + slot`.
  - Store `readPtr + 1` back to `headerCell - 1`.
- **Memory access**:
  - Read pointers: `readPtr = vm.memory.readCell(headerCell - 1)`, `writePtr = vm.memory.readCell(headerCell - 2)`.
  - Read data: `value = vm.memory.readCell(dataBase + slot)`.
  - Update pointer: `vm.memory.writeCell(headerCell - 1, readPtr + 1)`.

### `unread` (queue operation - push back value)

- **Stack**: `( x buffer/ref -- )`
- **Aliases**: `unshift` (for familiarity with array terminology)
- **Note**: Consumes both inputs (similar to pushing back into input stream in a tokenizer)
- **Behavior** (push value back into buffer):
  - Read `readPtr` and `writePtr`; if `(writePtr - readPtr) == N`, the buffer is full ⇒ **throw error**.
  - Set `nextReadPtr = readPtr - 1`.
  - Calculate `dataBase = headerCell - (N + 2)` and `slot = ((nextReadPtr % N) + N) % N`.
  - Write `x` to `dataBase + slot`.
  - Store `nextReadPtr` back to `headerCell - 1`.
- **Memory access**:
  - Read pointers: `readPtr = vm.memory.readCell(headerCell - 1)`, `writePtr = vm.memory.readCell(headerCell - 2)`.
  - Write pointer: `vm.memory.writeCell(headerCell - 1, nextReadPtr)`.
  - Write data: `vm.memory.writeCell(dataBase + slot, x)`.

### Query Operations

- `buf-size`: `( buffer/ref -- n )`
  - **Note**: Consumes buffer input, returns size
  - Read `readPtr` from `headerCell - 1`, `writePtr` from `headerCell - 2`
  - Returns `writePtr - readPtr` (guards guarantee `0 ≤ size ≤ N`)
- `is-empty`: `( buffer/ref -- 0|1 )`
  - **Note**: Consumes buffer input, returns boolean (0=false, 1=true)
  - Read `readPtr` from `headerCell - 1`, `writePtr` from `headerCell - 2`
  - Returns `1` if `readPtr == writePtr`, else `0`
- `is-full`: `( buffer/ref -- 0|1 )`
  - **Note**: Consumes buffer input, returns boolean (0=false, 1=true)
  - Read `readPtr` from `headerCell - 1`, `writePtr` from `headerCell - 2`
  - Returns `1` if `writePtr - readPtr == N`, else `0`

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

- `readPtr` cell = `headerCell - 1` (logical counter)
- `writePtr` cell = `headerCell - 2` (logical counter)
- Data base address: `dataBase = headerCell - (N + 2)` (lowest address)
- `data[i]` cell = `dataBase + i` = `headerCell - (N + 2) + i` where `i` is interpreted as the slot index after modulo reduction
- Example with N=10, headerCell=100: `dataBase = 100 - 12 = 88`, so `data[0]` = 88, `data[1]` = 89, ..., `data[9]` = 97

3. **Pointer values**: The pointer cells store **logical counters**, not bounded indices. Access proceeds as:
   - Read the counter: `ptr = vm.memory.readCell(headerCell - offset)`.
   - Calculate base: `dataBase = headerCell - (N + 2)`.
   - Reduce to a slot: `slot = ((ptr % N) + N) % N`.
   - Touch memory at `dataBase + slot`.

   This keeps the wrap logic isolated to the moment we touch memory, while the occupancy check relies on the simple arithmetic difference `writePtr - readPtr`.

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
42 &buf write        \ Write 42 (consumes 42 and &buf, writes to data[0], writePtr becomes 1)
43 &buf write        \ Write 43 (consumes 43 and &buf, writes to data[1], writePtr becomes 2)
&buf unwrite         \ Unwrite (consumes &buf, writePtr becomes 1, returns data[1]=43)
&buf unwrite         \ Unwrite (consumes &buf, writePtr becomes 0, returns data[0]=42)
```

**Using aliases** (push/pop/shift/unshift following JavaScript array terminology):

```
42 &buf push         \ Alias for write (consumes 42 and &buf)
&buf pop             \ Alias for unwrite (consumes &buf, returns value)
&buf shift           \ Alias for read (consumes &buf, returns value)
100 &buf unshift     \ Alias for unread (consumes 100 and &buf)
```

**Queue operations** (using read pointer for reading, write pointer for writing):

```
100 &buf write       \ Write 100 (consumes 100 and &buf, writes to data[0], writePtr becomes 1)
101 &buf write       \ Write 101 (consumes 101 and &buf, writes to data[1], writePtr becomes 2)
&buf read            \ Read (consumes &buf, reads data[0]=100, readPtr becomes 1)
100 &buf unread      \ Unread (consumes 100 and &buf, readPtr becomes 0, writes 100 back)
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

## Appendix A — Future Mode Bit Encoding

The current implementation treats every buffer as _strict_: attempts to write to a full buffer or read from an empty buffer result in exceptions. If a tolerant policy (for example, allowing overwrite-on-full) is ever needed, the LIST header’s meta bit can encode that policy without changing the payload shape:

- Interpret the meta bit on the buffer header (`LIST:(N+2)` with the high bit set) as a **tolerant mode** flag.
- Allocation (`buffer`) could set or clear the bit based on the desired policy; helper words could flip it after allocation if runtime toggling is required.
- Runtime operations would mask off the meta bit when deriving capacity (`N = (header & 0x7FFF) - 2`) and branch on the flag to decide whether to throw or to tolerate overflow/underflow (e.g. advance the opposite pointer instead of raising).

This preserves compatibility with existing helpers (such as `getListBounds` or `length`) as long as they ignore the meta bit when computing slot counts. No implementation work has been scheduled; the appendix simply records the option for future designs.
