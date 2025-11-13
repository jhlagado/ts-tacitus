# Buffers in Tacit: An Introduction

Buffers in Tacit are fixed-capacity ring buffers designed to support both stack-like and queue-like operations. They use a LIST header for memory allocation, but once allocated, they are treated as raw memory blocks with **array semantics** (address-increasing order), making them ideal for text buffers and sequential data storage.

## 1. Motivation

Many programming problems involve working with sequences of values that must be retained, revisited, or rotated. Buffers provide a way to temporarily retain elements, operate on them, and cycle through them — without committing to full immutability or streaming pull semantics.

A buffer is particularly helpful when you need a **finite, reusable workspace**:

- **Text buffers**: Sequential character storage where "hello" is stored as 'h', 'e', 'l', 'l', 'o' in address-increasing order
- **Command shell**: Maintain a rolling log of the most recent commands or messages
- **Sensor data** or **event streams**: Keep a fixed-size window of the latest measurements
- **Interactive graphics or games**: Manage a transient set of visible objects that continually updates

## 2. Design Philosophy

**LIST is ONLY for memory allocation** — once allocated, buffers ignore LIST semantics and treat the memory as a raw block with array semantics:

- Index 0 is at the **lowest address** (furthest from TOS)
- Index N-1 is at the **highest address** (closest to TOS)
- This is the opposite of LIST semantics (which are TOS-facing)
- Data is stored in **address-increasing order** (perfect for sequential reads like text buffers)

## 3. Layout and Structure

A buffer with capacity `N` elements has:

- **Total slots**: `N + 3` (header + readPtr + writePtr + N data slots)
- **Header**: `LIST:(N+2)` at TOS (SP) — used only for allocation
- **Pointers**: `readPtr` and `writePtr` stored at `SP-1` and `SP-2`
- **Data**: `data[0]` through `data[N-1]` stored in address-increasing order

**Memory layout example** (SP=100, N=10):

```
Address | Content
--------|--------
100     | LIST:12 (header)
99      | readPtr (initially 0)
98      | writePtr (initially 0)
97      | data[9] (highest address)
...
88      | data[0] (lowest address)
```

## 4. Stack and Queue Semantics

Buffers support two usage patterns:

### Stack Operations (using write pointer)

- **`write`** (alias: `push`): Write a value to the buffer, increment write pointer
- **`unwrite`** (alias: `pop`): Decrement write pointer, read the value

Example:

```
10 buffer var buf
&buf 42 write        \ Write 42 (consumes &buf and 42)
&buf 43 write        \ Write 43
&buf unwrite         \ Returns 43 (consumes &buf)
&buf unwrite         \ Returns 42
```

### Queue Operations (using read pointer)

- **`write`**: Write using write pointer (same as stack)
- **`read`**: Read using read pointer (separate from stack operations)

Example:

```
&buf 100 write       \ Write 100
&buf 101 write       \ Write 101
&buf read            \ Returns 100 (FIFO order)
&buf read            \ Returns 101
```

## 5. Operations

### Creation

- **`buffer`**: `( N -- buffer )` — Allocates a buffer with capacity N

### Stack Operations

- **`write`**: `( buffer/ref x -- )` — Writes value, consumes both inputs
- **`unwrite`**: `( buffer/ref -- v )` — Returns value, consumes buffer input
- **Aliases**: `push` = `write`, `pop` = `unwrite`

### Queue Operations

- **`read`**: `( buffer/ref -- v )` — Reads from read pointer, consumes buffer input

### Query Operations

- **`buf-size`**: `( buffer/ref -- n )` — Returns current size
- **`is-empty`**: `( buffer/ref -- 0|1 )` — Returns 1 if empty, 0 otherwise
- **`is-full`**: `( buffer/ref -- 0|1 )` — Returns 1 if full, 0 otherwise

All operations **consume the buffer/ref input** since buffers are typically stored in locals/globals, not kept on the stack.

## 6. Error Handling

Buffers use **strict error handling** — operations throw exceptions on overflow/underflow:

- `write` on full buffer → `Error("Buffer overflow")`
- `unwrite` on empty buffer → `Error("Buffer underflow")`
- `read` on empty buffer → `Error("Buffer underflow")`

## 7. Address-Increasing Order

The key feature of buffers is **address-increasing order** for data storage:

- `data[0]` is at the lowest address
- `data[N-1]` is at the highest address
- Sequential reads from low to high addresses yield data in correct order
- Perfect for text buffers: "hello" stored as 'h' at data[0], 'e' at data[1], etc.

This makes buffers ideal for:

- Text processing (characters stored sequentially)
- Sequential data access patterns
- Memory-mapped I/O scenarios

## 8. Integration with Locals and Globals

Buffers are typically stored in local variables or globals:

```
10 buffer var buf    \ Allocate and store in local
&buf 42 write        \ Write to buffer via ref
&buf unwrite         \ Read from buffer via ref
```

The buffer operations consume the ref, so you need to pass `&buf` each time you want to operate on it.

## 9. Use Cases

- **Text buffers**: Sequential character storage with address-increasing order
- **Traversal stacks**: Bounded LIFO storage
- **Token queues**: FIFO storage with separate read/write pointers
- **Sliding windows**: Fixed-capacity rolling history

## 10. Reference

For complete specification details, see `docs/specs/buffers.md`.
