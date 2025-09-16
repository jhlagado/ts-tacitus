# Ring Buffer Specification for TACIT Capsules

## Purpose

To define a unified structure for fixed-size, mutable buffers used in stack-like or queue-like modes within TACIT capsules. These buffers are implemented as ring buffers (circular arrays) and may be embedded as local variables in capsule memory frames.

## Design Goals

- **Constant-size allocation:** No dynamic resizing or heap allocation.
- **Modular indexing:** Wrapping behavior for index increment/decrement.
- **Dual-mode usage:** Allow push/pop for stack mode, shift/unshift for queue mode.
- **Encapsulation:** Buffer is self-contained within a capsule or a local var frame.
- **In-place mutation:** Safe updates to simple values within buffer.

## Memory Layout

Each buffer is represented as a fixed-length list with an attached header. The header contains:

- **capacity** (fixed at creation)
- **start index** (points to first logical element)
- **end index** (points to where next insert will happen)
- **count** (number of valid elements)

All indices are modulo `capacity`.

## API

### Stack-like (LIFO)

- `push(x)`:
  - Writes `x` at `end index`, then increments `end`, increments `count`.

- `pop()`:
  - Decrements `end`, reads value at new `end`, decrements `count`.

### Queue-like (FIFO)

- `shift()`:
  - Reads value at `start`, increments `start`, decrements `count`.

- `unshift(x)`:
  - Decrements `start`, writes `x`, increments `count`.

### Random access

- `get(i)`:
  - Reads value at `(start + i) % capacity`.

- `set(i, x)`:
  - Writes value at `(start + i) % capacity`.

## Overflow Policy

By default, `push` and `unshift` fail silently or return NIL if `count == capacity`.

### Optional Mode: Overwrite

If `overwrite` flag is set:

- `push` overwrites the oldest value by incrementing `start` when full.
- `unshift` overwrites newest value by decrementing `end`.

## Integration in Capsules

Buffers may be declared as:

```tacit
var myStack stack[16]  \ allocates 16-slot stack
var myQueue queue[8]   \ allocates 8-slot ring buffer for queueing
```

These allocate a structure on the return stack (or later, in capsule memory) with embedded metadata and payload.

## Use Cases

- **Tree traversal stacks**
- **Undo/redo history**
- **Windowed joins (buffered zip)**
- **Token queues / stream buffers**

## Future Extensions

- Optional timestamp metadata per slot
- Clock-triggered purge / expiration
- Blocking semantics (wait until non-empty/full)
- Shared-memory or multi-VM safe version

### Ring Buffer Operations

| Operation   |  Direction      | Pointer Affected | Semantics         | Wrap Behavior | Tacit Use Case      |
| ----------- |  -------------- | ---------------- | ----------------- | ------------- | ------------------- |
| `push`      |  → tail (end)   | `tail++`         | Append to end     | wrap if full  | Stack push          |
| `pop`       |  ← tail (end)   | `tail--`         | Remove from end   | wrap if empty | Stack pop           |
| `shift`     |  → head (start) | `head++`         | Remove from start | wrap if empty | FIFO dequeue        |
| `unshift`   |  ← head (start) | `head--`         | Prepend to start  | wrap if full  | FIFO enqueue        |
