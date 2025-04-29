# Implementation Status: Future Specification
- This document outlines the planned cooperative multitasking architecture
- Currently **Not Implemented** in the codebase
- Related concepts: See [deferred.md] for current thunk implementation

**Tacit Virtual Machine: Full Runtime Architecture Specification (Fully Expanded, >1000 lines)**

---

# Introduction

Tacit is a minimalist, deterministic, event-driven virtual machine optimized for embedded, symbolic, and real-time applications. This detailed specification documents every aspect of the system, from the core execution model to future extension points. Each section below doubles previous depth, providing exhaustive descriptions, diagrams, pseudocode, tables, and rationale.

**Key Principles:**

- **Determinism & Observability:** All state transitions and scheduling decisions are explicit.
- **Cooperative Concurrency:** Tasks voluntarily yield or suspend; no preemption.
- **Uniform Data Model:** Single 32-bit tagged value type underpins all operations.
- **Event-Driven Coordination:** A single event queue mediates all inter-task and I/O notifications.
- **Fixed-Size I/O Buffers:** UTF-8 safe, line-oriented, with suspension-based flow control.

This spec is organized into seven fully fleshed-out sections, each with multiple subsections and implementation depths.

---

## 1. Core Execution Model

### 1.1 Overview of Cooperative Concurrency

#### 1.1.1 Rationale Against Preemption

- Preemption introduces nondeterminism and race conditions. Tacit avoids interrupts entirely, relying on tasks to signal when they can yield.
- Contrast with RTOS: tacit’s scheduler is simpler, no ISR integration, leading to predictable latency and easier verification.

#### 1.1.2 Yield Points

- Every opcode executes atomically from the scheduler’s perspective. Only `YIELD`, `WAIT`, and blocking I/O cause the task to relinquish control.
- Tasks may call `YIELD` periodically during heavy computation to improve fairness.

#### 1.1.3 Scheduling Fairness Guarantees

- Implements strict round-robin: each runnable task receives one instruction quantum per cycle.
- Starvation-free: because tasks cannot bypass the scheduler without yielding, all active tasks make progress.

### 1.2 Detailed Stack-Based RPN Execution

#### 1.2.1 Data Stack Structure

- Data stack length: 32 entries, 4 bytes each (128 bytes).
- Managed via `SP` register. Underflow/overflow traps are immediate errors.

#### 1.2.2 Return Stack Semantics & Stack Frames
- The return stack holds saved IPs for `CALL`/`RET`, saved Base Pointers (`BP`) for frame management, and local variables.
- `CALL` pushes the return IP, pushes the caller's `BP`, and sets the new `BP` to the current `RP`, establishing a new stack frame.
- `RET` unwinds the current frame (restoring `RP` to `BP`), restores the caller's `BP`, and then pops the return IP.
- Local variables reside on the return stack between `BP` and `RP`.

#### 1.2.3 Parameter Passing and Local Variables
- Tacit uses the data stack for parameter passing.
- Local variables provide named temporary storage within a function's stack frame on the return stack, accessed via offsets from `BP`. They reduce the need for excessive data stack manipulation. Locals are managed entirely by the compiler and VM frame mechanics, with no heap allocation or closures.

### 1.3 Expanded Opcode Reference

| Opcode           | Byte           | Name              | Stack Effect                                                                            | Detailed Description                                    |
| ---------------- | -------------- | ----------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 0x00             | NOP            | NOP               | —                                                                                       | Does nothing; often used for alignment or patch points. |
| 0x01 ii          | PUSH\_CONST    | → const[ii]       | Pushes constant pool entry at index ii (16-bit index).                                  |                                                         |
| 0x02 vv          | PUSH\_INT      | → int(vv)         | Pushes an 8-bit signed integer vv, sign-extended to 32-bit tagged integer.              |                                                         |
| 0x03             | DUP            | a → a a           | Duplicates the top-of-stack value.                                                      |                                                         |
| 0x04             | SWAP           | a b → b a         | Swaps the top two values.                                                               |                                                         |
| 0x05             | DROP           | a →               | Pops and discards the top value.                                                        |                                                         |
| 0x10             | ADD            | a b → a+b         | Adds two numeric values, pushes result. Overflows wrap on integer; floats use IEEE-754. |                                                         |
| 0x11             | SUB            | a b → a−b         | Subtracts second from first.                                                            |                                                         |
| 0x12             | MUL            | a b → a×b         | Multiplies.                                                                             |                                                         |
| 0x13             | DIV            | a b → a÷b         | Divides; trap on integer divide by zero.                                                |                                                         |
| 0x14             | MOD            | a b → a mod b     | Integer modulus; `b == 0` traps.                                                        |                                                         |
| 0x20 oo oo       | JMP            | — →               | Jumps to relative offset (signed 16-bit). Detailed wrap and alignment rules follow.     |                                                         |
| 0x21 oo oo       | JZ             | a →               | Pops `a`; if zero/NIL, jumps by offset; else continues.                                 |                                                         |
| 0x22 oo oo       | CALL           | — →               | Save `(IP+3)` to return stack, save current `BP` to return stack, set `BP = RP`, then `IP += offset`. |
| 0x23             | RET            | — →               | Set `RP = BP`, pop return stack into `BP`, pop return stack into `IP`.                          |
| 0x30 aa aa aa aa | LOAD           | → value           | Load a tagged value from memory address `aa...` (32-bit address).                       |                                                         |
| 0x31 aa aa aa aa | STORE          | value →           | Store tagged value into memory.                                                         |                                                         |
| 0x40             | WAIT           | tag →             | Pop tag, set `wait_tag`, yield. The tag may be a symbol or task ID.                     |                                                         |
| 0x41             | YIELD          | — →               | Yield control cooperatively; `wait_tag` remains NIL.                                    |                                                         |
| 0x42             | SEND           | event →           | Pop event, append to event queue. If full, task must suspend and retry.                 |                                                         |
| 0x50             | SPAWN          | addr → task\_id   | Pop code address, find free task, initialize, return Task ID.                           |                                                         |
| 0x51             | WAIT\_TASK     | task\_id →        | Pop Task ID, set `wait_tag=task_id`, yield.                                             |                                                         |
| 0x52             | GET\_RET\_CODE | task\_id → code   | Pop Task ID, push its `return_code`.                                                    |                                                         |
| 0x60             | TERMINATE      | code →            | Pop exit code, set `return_code`, set `wait_tag=code`, yield.                           |                                                         |
| 0x70             | READ\_CHAR     | buf\_id → char    | Pop buffer ID, read next UTF-8 character, push as tagged integer or symbol.             |                                                         |
| 0x71             | READ\_LINE     | buf\_id → ptr     | Pop buffer ID, read full line into heap, return pointer to line object.                 |                                                         |
| 0x72             | WRITE\_STR     | buf\_id ptr →     | Pop buffer ID and string pointer, push each UTF-8 byte to line buffer; suspend on full. |                                                         |
| 0x80             | DEBUG\_PRINT   | msg\_id →         | Pop message symbol, write to debug console.                                             |                                                         |
| 0x81             | TASK\_STATUS   | task\_id → status | Push specified task’s flags/internals as a record.                                      |                                                         |
| 0xXX             | GET_LOCAL      | → value           | (Proposed) Read local variable at offset `XX` relative to `BP`, push to data stack.             |                                                         |
| 0xXY             | SET_LOCAL      | value →           | (Proposed) Pop value from data stack, write to local variable at offset `XY` relative to `BP`. |

*(Additional opcodes for sequence processing such as **********`EACH`**********, **********`MAP`**********, **********`FILTER`**********, **********`FOLD`**********, **********`RANGE`********** are documented separately.)*

### 1.5 Pseudocode: Full Dispatch Loop

```c
void run_scheduler() {
  for (;;) {
    for (int i = 0; i < MAX_TASKS; ++i) {
      Task *t = &tasks[i];
      if (t->return_code == NIL && t->wait_tag == NIL) {
        execute_one_instruction(t);
      }
    }
  }
}

void execute_one_instruction(Task *t) {
  uint8_t op = fetch_byte(&t->ip);
  switch (op) {
    case OPC_ADD:
      { TValue b = pop(&t->sp), a = pop(&t->sp);
        push(&t->sp, tagged_add(a,b)); }
      return;
    case OPC_WAIT:
      { TValue tag = pop(&t->sp);
        t->wait_tag = tag;
        return; }
    case OPC_YIELD:
      return;
    case OPC_SEND:
      { TValue ev = pop(&t->sp);
        if (!event_queue_push(ev)) {
          t->wait_tag = symbol:event_queue_full;
          return;
        }
      }
      return;
    case OPC_CALL:
      { uint16_t offset = fetch_short(&t->ip);
        rpush(&t->rp, t->ip); // Push return address
        rpush(&t->rp, t->bp); // Push old Base Pointer
        t->bp = t->rp;        // Set new Base Pointer
        t->ip += offset; }    // Jump to function
      return;
    case OPC_RET:
      { t->rp = t->bp;        // Discard locals & saved BP by resetting RP
        t->bp = rpop(&t->rp); // Restore caller's Base Pointer
        t->ip = rpop(&t->rp); // Pop return address
      }
      return;
    /* Full handling for all opcodes per table above */
  }
}
```

### 1.6 Discussion: JIT vs Interpreter

#### 1.6.1 Interpretation Overhead

- Each opcode dispatch involves a switch statement; branch-prediction and table-driven dispatch can optimize.
- NaN-box handling: using bitmasks to extract tag/type at runtime.

#### 1.6.2 Optional JIT Layer

- A simple baseline JIT could translate sequences of hot bytecode into native code blocks.
- System must maintain fallbacks in case of code changes (e.g., dynamic SPAWN altering code segment).

#### 1.6.3 Trade-offs

- JIT increases memory and complexity; initial target is interpreter-only.
- Later, embed hotspots in native stubs for heavy math or string routines.

### 1.7 Instruction Prefetch & Loop Unrolling

#### 1.7.1 Prefetch Buffer

- Implement a small circular prefetch buffer to reduce memory stalls.

#### 1.7.2 Superinstructions

- Combine frequent opcode sequences into single superinstructions (e.g., `ADD;YIELD`).
- Reduces dispatch overhead at cost of code size.

### 1.8 Formal Verification Notes

- **State Invariants:** `0 <= SP <= STACK_SIZE`, `0 <= IP < CODE_SIZE`, `wait_tag` only set via WAIT/I/O operations.
- **Safety:** All writes to task contexts and ring buffers use atomic operations or protected via scheduler lock-free invariants.

---

## 2. Task Structure (Fully Expanded)

Tasks in Tacit are **self-contained execution contexts**. Each task occupies a fixed-size, aligned memory block, now expanded to **424 bytes** to accommodate a larger return stack and base pointer, laid out for cache-friendly access and minimal indirection. This section details every field, its purpose, alignment considerations, lifetime, and interactions with the scheduler and debugger.

### 2.1 High-Level Overview

- **Preallocated Pool**: A fixed number of task slots (e.g., 32) are allocated at boot. No dynamic task creation beyond this pool.
- **Contiguous Memory Layout**: Each task is stored in a contiguous, aligned block, ensuring predictable offsets.
- **Isolation**: Tasks do not share mutable state; communication is via events or buffers.
- **Cooperative Control**: Suspension, resumption, and termination are explicit operations that update task fields.

### 2.2 Task Memory Layout Diagram (Updated)

```
0x00 ─── 2 bytes   Instruction Pointer (IP)
0x02 ─── 1 byte    Stack Pointer (SP)
0x03 ─── 1 byte    Return Stack Pointer (RP)
0x04 ─── 1 byte    Base Pointer (BP)
0x05 ─── 1 byte    Flags
0x06 ─── 2 bytes   Task ID
0x08 ─── 4 bytes   Wait Tag
0x0C ─── 4 bytes   Inbox (last event)
0x10 ─── 4 bytes   Return Code
0x14 ─── 4 bytes   Reserved (alignment)
0x18 ─── 128 bytes Data Stack (32 × 4B entries)
0x98 ─── 256 bytes Return Stack (64 × 4B entries) - Increased Size
0x198 ─── 12 bytes  Reserved / Debug Fields
0x1A4 ─── (&size=424 bytes)
```

### 2.3 Field Descriptions (Updated)

#### 2.3.1 Instruction Pointer (IP)

- **Offset**: 0x00, **Size**: 2 bytes (16-bit)
- **Purpose**: Holds the current bytecode offset. Allows up to 64 KB of code.
- **Behavior**: Incremented after each fetch; modified by `JMP`, `CALL`, `RET`.
- **Alignment**: 2-byte aligned to support efficient 16-bit loads.

#### 2.3.2 Stack Pointer (SP)

- **Offset**: 0x02, **Size**: 1 byte
- **Purpose**: Points to the next free slot in the Data Stack (0..32).
- **Behavior**: Incremented/decremented by stack operations (`PUSH`, `POP`, etc.).
- **Overflow Handling**: If `SP` > 32, a stack-overflow trap is raised (`return_code = symbol:stack_overflow`).
- **Underflow Handling**: If `SP` == 0 and a `POP` occurs, trap (`return_code = symbol:stack_underflow`).

#### 2.3.3 Return Stack Pointer (RP)

- **Offset**: 0x03, **Size**: 1 byte
- **Purpose**: Points to the next free slot in the Return Stack (0..64). Used for `CALL`/`RET` addresses, saved `BP`, and allocating space for local variables above `BP`.
- **Use Cases**: `CALL` pushes return IP and old `BP`; `RET` pops them after resetting `RP` to `BP`. Local variable allocation increments `RP`.
- **Overflow/Underflow**: Traps if `RP` exceeds 64 or goes below 0; `return_code` set accordingly.

#### 2.3.4 Base Pointer (BP) - New Field

- **Offset**: 0x04, **Size**: 1 byte
- **Purpose**: Points to the base of the current stack frame on the Return Stack (0..64). Marks the location of the saved caller's `BP`. Local variables are accessed via positive offsets from `BP`.
- **Behavior**: Set by `CALL` to the current `RP` after pushing the old `BP`. Restored by `RET` before popping the return IP. Used by `GET_LOCAL`/`SET_LOCAL` opcodes to calculate addresses.

#### 2.3.5 Flags (Moved)

- **Offset**: 0x05, **Size**: 1 byte
- **Bit Layout:** (Same as before)
  - **Bit 0**: Error flag (set on traps).
  - **Bit 1**: Reserved for future use.
  - **Bits 2–7**: Unused.

#### 2.3.6 Task ID (Moved)

- **Offset**: 0x06, **Size**: 2 bytes
- **Purpose**: Unique identifier for the task.
- **Range**: 0…MAX\_TASKS−1.

#### 2.3.7 Wait Tag (Moved)

- **Offset**: 0x08, **Size**: 4 bytes
- **Purpose**: Encodes the reason for suspension. `NIL` implies runnable.

#### 2.3.8 Inbox (Moved)

- **Offset**: 0x0C, **Size**: 4 bytes
- **Purpose**: Stores the last event or data that caused a resume.

#### 2.3.9 Return Code (Moved)

- **Offset**: 0x10, **Size**: 4 bytes
- **Purpose**: Holds the exit code after `TERMINATE`. `NIL` if active/suspended.

#### 2.3.10 Reserved / Debug Fields (Moved & Updated Offset)

- **Offset**: 0x198–0x1A3, **Size**: 12 bytes
- **Purpose**: Placeholder for debug breakpoints, instrumentation counters, or future expansion.

### 2.4 Stack Regions (Updated)

#### 2.4.1 Data Stack

- **Size**: 32 entries × 4 bytes = 128 bytes.
- **Usage**: Operand stack for all computations.
- **Initial State**: All entries `NIL`.
- **Growth Strategy**: Inline in task slot for locality; no dynamic extension.

#### 2.4.2 Return Stack (Updated Size & Usage)

- **Size**: 64 entries × 4 bytes = 256 bytes. (Increased from 16 entries / 64 bytes)
- **Usage**: Holds call/return addresses, saved Base Pointers (`BP`), and function local variables. Managed jointly by `RP` (top of stack) and `BP` (base of current frame).
- **Initial State**: All entries `NIL`.
- **RP/BP Management**: `CALL` pushes return IP, pushes old `BP`, sets `BP = RP`. `RET` sets `RP = BP`, pops `BP`, pops return IP. Local variable allocation increments `RP`. Underflow/overflow trap if limits exceeded.

### 2.5 Task Lifecycle and Transitions (Updated)

**Creation (Boot):**

- Zero all bytes.
- Set `IP` to boot code addresses for initial tasks.
- `SP=RP=BP=0`, `wait_tag=return_code=NIL`, `flags=0`.

**Scheduling:**

- Scheduler scans slots in round-robin order.
- If `wait_tag==NIL` and `return_code==NIL`, the task is eligible to run.

**Suspension:**

- On `WAIT` or blocking I/O, set `wait_tag`, optionally leave `inbox` populated, and return control.

**Resumption:**

- On delivery of matching event or buffer condition, system clears `wait_tag`, writes to `inbox`, and marks task runnable.
- The task resumes at the instruction following the suspension opcode.

**Termination:**

- `TERMINATE` opcode pops exit code, writes to `return_code`. Before yielding, it should perform the frame unwinding part of `RET` (set `RP=BP`, pop `BP`) to ensure stack consistency if termination happens mid-function. Then sets `wait_tag` to block forever.
- The task is skipped by scheduler; slot flagged free for `SPAWN`.

**Reclamation (SPAWN):**

- `SPAWN` scans for the first task where `return_code!=NIL`.
- Calls `reset_task_slot()` to zero all fields (including `BP`), sets new `IP`, `return_code=wait_tag=NIL`, `SP=RP=BP=0`, and returns new Task ID.

### 2.6 Reliability & Debugging Support

#### 2.6.1 Error Trapping

- Traps (stack overflow, illegal opcode, memory fault) set `return_code` to a distinct symbol (e.g., `symbol:illegal_opcode`).
- Optionally set an error flag bit.

#### 2.6.2 Introspection API

- `DEBUG_PRINT` opcode for tasks to emit messages.
- `TASK_STATUS` opcode pushes a record of `IP`, `SP`, `RP`, `wait_tag`, `return_code`, and `flags`.

#### 2.6.3 Watchpoints

- Reserved bytes at 0xD8–0xDF can store watchpoint IDs.
- A debug monitor can trap reads/writes to flagged fields.

### 2.7 Alternative Stack Strategies

#### 2.7.1 External Stacks

- If inline stacks are insufficient, `SP` and `RP` can serve as offsets into a shared stack pool.
- Pros: larger dynamic capacity.
- Cons: indirection overhead, fragmentation risk.

#### 2.7.2 Guard Pages

- Place guard pages around task slots in memory to catch buffer underruns/overruns.
- Requires OS or MMU support.

### 2.8 Memory Alignment & Cache Considerations (Updated Size)

- Task slots aligned to 64 bytes for cache-line efficiency. Total size is now 424 bytes.
- Field alignment ensures 32-bit word accesses for key fields (e.g., `wait_tag`, `return_code`).
- Inline stacks improve spatial locality during hot code paths.

### 2.9 Task Table and Free-List Management

- Primary scan via simple for-loop is efficient with small `MAX_TASKS`.
- For larger scales, maintain a free-list of terminated task IDs for O(1) allocation.

### 2.10 Security & Isolation

- Tasks share memory only via explicit pointers and events.
- No direct memory sharing prevents data races.
- Supervisor mode can restrict certain opcodes (e.g., `LOAD`/`STORE`) for untrusted code.

### 2.11 Performance Metrics

- Per-task counters: instructions executed, cycles spent, events waited.
- Stored in reserved debug fields for profiling.



---

## 3. Event Model (Fully Expanded)

The Event Model in Tacit serves as the **sole mechanism** for inter-task communication, synchronization, and I/O notification. Events are represented by **tagged values** and managed in a **lock-free ring buffer**, supporting priority insertion, cancellation, multi-receiver broadcasts, and observability.

### 3.1 Philosophical Foundation

- **Declarative Signaling:** Tasks declare their suspension conditions by setting `wait_tag`. No polling or busy-wait.
- **Uniform Representation:** All events—control signals, data notifications, errors—are 32-bit tagged values.
- **Central Dispatch:** A single event queue avoids complex channel constructs.
- **Deterministic Delivery:** Events are matched in a fixed order, ensuring reproducible behavior.

### 3.2 Tagged-Value Event Encoding

- **Type Bits:** Upper NaN-box bits designate event categories: `symbol`, `task_id`, `buffer_id`, or `error_code`.
- **Payload Bits:** Lower bits carry either a small integer, pointer to a payload, or symbol index.
- **Common Event Symbols:**
  - `symbol:line_ready` – indicates a newline in a buffer.
  - `symbol:buffer_full`, `symbol:buffer_empty` – flow-control markers.
  - `symbol:timeout_%d` – timer event placeholders.

### 3.3 Event Queue Data Structure

```
struct EventQueue {
  uint8_t head;        // Next write index (0..63)
  uint8_t tail;        // Next read index
  uint8_t count;       // Number of events present
  uint8_t flags;       // Bit0: overflow, Bit1: priority mode
  TValue entries[64];  // Circular buffer of tagged values
};
```

- **Size:** 64 × 4 bytes + 4 bytes metadata = 260 bytes.
- **Alignment:** 4-byte alignment for entries; metadata aligned to cache line.

### 3.4 Core Operations

#### 3.4.1 `enqueue_event(TValue ev)`

```c
bool enqueue_event(EventQueue *q, TValue ev) {
  if (q->count == 64) {
    q->flags |= 0x1; // overflow indicator
    return false;
  }
  q->entries[q->head] = ev;
  q->head = (q->head + 1) & 63;
  q->count++;
  return true;
}
```

- **Behavior on Full:** sets `overflow` flag and returns `false`; caller must suspend and retry.

#### 3.4.2 `dequeue_event(TValue *out)`

```c
bool dequeue_event(EventQueue *q, TValue *out) {
  if (q->count == 0) return false;
  *out = q->entries[q->tail];
  q->tail = (q->tail + 1) & 63;
  q->count--;
  return true;
}
```

- **Empty:** returns `false`, indicating no events to process.

### 3.5 Priority and Cancellation

- **High-Priority Insertion:** control events like `symbol:ctrl_c` use:

```c
void enqueue_priority(EventQueue *q, TValue ev) {
  q->head = (q->head - 1) & 63;
  q->entries[q->head] = ev;
  if (q->count < 64) q->count++;
  else q->flags |= 0x1;
}
```

- **Cancellation:** tasks can remove pending events by scanning and marking entries as `NIL`, later compacted by background sweeper.

### 3.6 Dispatch Mechanism

```c
void dispatch_events() {
  TValue ev;
  while (dequeue_event(&global_queue, &ev)) {
    for (int i = 0; i < MAX_TASKS; ++i) {
      Task *t = &tasks[i];
      if (t->wait_tag == ev) {
        t->wait_tag = NIL;
        t->inbox = ev;
        break; // single receiver
      }
    }
  }
}
```

- **Single-Receiver by Default:** stops at first match for efficiency.
- **Broadcast Mode:** remove `break` to resume all matching tasks.

### 3.7 Event Matching Policies

- **Exact Match:** bitwise equality of `wait_tag` and event.
- **Pattern-Based:** future extension supports wildcards (e.g., symbol prefix matching).
- **Priority Delivery:** urgent events bypass standard queue.

### 3.8 Debugging and Metrics

- **Event Counters:** `events_enqueued`, `events_dispatched`, `dispatch_latency_µs` per task.
- **Circular Log:** last 16 events stored in `debug_log[16]`, with timestamp.
- **Instrumentation Hooks:** user code can call `LOG_EVENT(ev)` to trace sequences.

### 3.9 Formal Properties

- **Wait-Free Reads:** `dequeue_event` never blocks; tasks manage suspension.
- **Lock-Free Writes:** `enqueue_event` only disables when full; no locks needed.
- **Linearizability:** events appear in buffer order under atomic operations.

### 3.10 Example Workflow

1. **Task A** executes `SEND symbol:line_ready` after writing a newline.
2. **Global Dispatcher** de-queues the event, scans tasks.
3. **Task B** has `wait_tag == symbol:line_ready`; dispatcher clears its tag, sets `inbox`.
4. On next scheduler cycle, Task B resumes, executes `LOAD inbox`, processes line.

---

## 4. Line Buffers (Fully Expanded) (Fully Expanded)

Line buffers in Tacit serve as the bridge between byte-oriented I/O sources (such as UART, files, or terminals) and task-level text processing. They implement a **circular 256-byte buffer** optimized for UTF-8 text, with cooperative suspension for flow control. This section provides every implementation detail, from memory layout and encoding FSMs to producer/consumer algorithms, alternatives, and debugging hooks.

### 4.1 Design Goals and Rationale

- **UTF-8 Safety:** Ensure multi-byte codepoints are neither split nor lost across buffer boundaries.
- **Fixed Size for Determinism:** A constant 256-byte footprint simplifies allocation and prefix-free addressing.
- **Zero-Copy Access:** Tasks operate on raw buffer memory where possible, avoiding heap allocations.
- **Cooperative Flow Control:** Writers and readers suspend rather than overwrite or busy-wait.
- **Line-Oriented API:** Tasks deal in lines or characters, not raw bytes.

### 4.2 Memory Layout and Alignment

```
Offset | Size | Field
-------|------|-----------------------------
0x00   | 1    | head       ; index to write next byte (0..255)
0x01   | 1    | tail       ; index to read next byte
0x02   | 1    | flags      ; bit0: has_newline, bit1: overflow
0x03   | 1    | reserved   ; for future control bits
0x04   | 252  | data[252]  ; raw UTF-8 byte storage
```

- **Total:** 256 bytes per buffer.
- **Alignment:** Entire buffer aligned to 64-byte cache line boundaries for I/O performance.

### 4.3 Flags Field

- **Bit 0 (0x01) has\_newline:** Set when a `'
  '` (0x0A) byte is written.
- **Bit 1 (0x02) overflow:** Set when writer attempts to write into a full buffer.
- **Bits 2–7:** Reserved for future semantics (e.g., binary mode, low-water notifications).

### 4.4 Producer (Writer) Algorithm

#### 4.4.1 UTF-8 Boundary Check

```c
bool can_write_sequence(LineBuf *b, int seq_len) {
  int avail = (b->tail + 256 - b->head) % 256;
  return avail >= seq_len;
}
```

- **Rationale:** Avoid splitting codepoints across wrap-around.

#### 4.4.2 Writing Bytes

```c
int write_bytes(LineBuf *b, const uint8_t *bytes, int len) {
  if (!can_write_sequence(b, len)) {
    b->flags |= 0x02; // overflow
    return 0; // suspend writer
  }
  for (int i = 0; i < len; ++i) {
    b->data[b->head] = bytes[i];
    b->head = (b->head + 1) & 0xFF;
    if (bytes[i] == '
') b->flags |= 0x01;
  }
  return len;
}
```

- **Return Value:** Number of bytes written; 0 indicates suspension.
- **Overflow Flag:** Signals tasks or system to clear overflow.

### 4.5 Consumer (Reader) Algorithm

#### 4.5.1 Checking for Data

```c
bool has_data(LineBuf *b) {
  return b->head != b->tail;
}
```

- **Empty Check:** `head == tail` indicates buffer empty.

#### 4.5.2 Reading a Character

```c
int read_char(LineBuf *b, TValue *out) {
  if (!has_data(b)) return 0; // suspend reader

  uint8_t first = b->data[b->tail];
  int seq_len = utf8_sequence_length(first);
  int available = (b->head + 256 - b->tail) % 256;
  if (available < seq_len) return 0; // incomplete sequence

  // Decode codepoint
  uint32_t codepoint;
  decode_utf8(&b->data[b->tail], seq_len, &codepoint);

  b->tail = (b->tail + seq_len) & 0xFF;
  if (first == '
') b->flags &= ~0x01;

  *out = tag_from_codepoint(codepoint);
  return 1;
}
```

- **UTF-8 FSM:** `utf8_sequence_length()` and `decode_utf8()` implement a standard decoding finite-state machine.
- **Return Value:** 1 on success; 0 to indicate suspension.

#### 4.5.3 Reading a Line

```c
int read_line(LineBuf *b, char *out, int maxlen) {
  if (!(b->flags & 0x01)) return 0; // no newline → suspend
  int count = 0;
  uint8_t c;
  while (read_char(b, &c) == 1 && count < maxlen) {
    out[count++] = (char)c;
    if (c == '
') break;
  }
  return count;
}
```

- **Line Buffering:** Waits for newline or full line up to `maxlen`.

### 4.6 Flow-Control Suspension

- **Writer Suspension:** If `write_bytes()` returns 0, the writer task executes:
  ```forth
  PUSH buffer_id
  WAIT                  ; suspend until buffer_space_available event
  ```
- **Reader Suspension:** If `read_char()` or `read_line()` returns 0, reader suspends similarly.

### 4.7 Control Codes and Escape Sequences

- **Backspace (********`0x08`********\*\*\*\*\*\*\*\*\*\*\*\*):** Writer may handle by moving `head` back and rewriting.
- **Carriage Return (********`0x0D`********\*\*\*\*\*\*\*\*\*\*\*\*):** Optionally ignored (`bytes[i] == 0x0D` skip).
- **ANSI Escape Parsing:** A higher-level task can consume raw escape sequences starting with `0x1B` and interpret them.

### 4.8 Alternatives and Extensions

#### 4.8.1 Binary Mode

- Use `flags & 0x04` to bypass UTF-8 FSM, reading raw bytes.

#### 4.8.2 Dynamic Sizing

- While 256 bytes is default, allow advisory size in constructor: `init_linebuf(buf, size)`, storing `size` in reserved fields.

#### 4.8.3 Buffer Mirroring

- For read-ahead or lookahead, maintain a shadow copy of last N bytes in debug fields.

### 4.9 Debugging and Instrumentation

- **Metrics:** `bytes_written`, `bytes_read`, `lines_read`, `lines_written` counters per buffer.
- **Error Logs:** Circular log of last overflow or malformed sequence events.
- **Assertions:** Validate `head`, `tail` remain in `[0, size)`.

### 4.10 Example Usage in Bytecode

```forth
; Task to echo input lines to output
LOOP:
  PUSH_INT 0          ; stdin buffer ID
  READ_LINE           ; suspend until line available
  PUSH_INT 1          ; stdout buffer ID
  SWAP                ; bring line pointer
  WRITE_STR           ; write line
  YIELD
  JMP LOOP
```

---

## 5. Blocking & Flow Control (Fully Expanded)

Blocking and flow control in Tacit are implemented via **declarative task suspension** and **event-driven resumption**. This section describes every aspect of how and why tasks block, how the scheduler handles blocked tasks, mechanisms to avoid starvation and deadlocks, and instrumentation to analyze system behavior.

### 5.1 Design Principles

- **Cooperative Suspension:** Tasks explicitly declare block conditions; no implicit waiting.
- **No Busy-Waiting:** Blocked tasks consume zero CPU cycles until resumed.
- **Single Mechanism:** All blocking (I/O, inter-task, timeouts) uses the same `wait_tag` abstraction.
- **Determinism:** Block and resume events occur in a predictable, repeatable order.

### 5.2 Blocking Scenarios

Tasks may block in several common scenarios:

#### 5.2.1 Full Buffer Write

- **Condition:** Attempt to write to a line buffer or event queue that is full.
- **Action:** The write primitive returns 0; task executes:
  ```forth
  PUSH symbol:buffer_full
  WAIT          ; suspend until buffer_space_available event
  ```
- **Rationale:** Avoid data loss; preserve backpressure.

#### 5.2.2 Empty Buffer Read

- **Condition:** Reader calls `READ_CHAR` or `READ_LINE` when no data is available.
- **Action:** Primitive returns 0; task executes:
  ```forth
  PUSH symbol:buffer_empty
  WAIT          ; suspend until buffer_data_ready event
  ```

#### 5.2.3 Waiting for Specific Event

- **Condition:** Task logic requires synchronization (e.g., completion of another task).
- **Action:** Use `WAIT` or `WAIT_TASK`:
  ```forth
  PUSH symbol:resource_ready
  WAIT          ; suspend until matching event arrives
  ```

#### 5.2.4 Timeout-Based Blocks

- **Condition:** Task needs a timeout (future extension via `symbol:timeout_X`).
- **Action:** Tag-based:
  ```forth
  PUSH symbol:timeout_100  ; 100 ticks
  WAIT                     ; suspend until timeout event
  ```

### 5.3 Suspension Semantics

When a task executes a blocking opcode:

1. **Set ********************`wait_tag`********************:** The task’s `wait_tag` field is updated to the tagged value representing the block condition.
2. **Yield Control:** The interpreter returns from `execute_one_instruction`, allowing the scheduler to proceed to the next task.
3. **State Quiescence:** IP, SP, RP, and data stacks remain unchanged; the task freezes.

**Illustration:**

```c
case OPC_WAIT: {
  TValue tag = pop(&t->sp);
  t->wait_tag = tag;
  return; // control returns to scheduler
}
```

### 5.4 Resumption Semantics

A blocked task is resumed only when a matching event is dispatched:

1. **Event Occurrence:** A system component or task enqueues an event (e.g., `symbol:buffer_full` → `symbol:buffer_space`).
2. **Dispatcher Scan:** `dispatch_events()` iterates over the event queue and suspended tasks.
3. **Match & Clear:** If `t->wait_tag == ev`, then:
   - `t->wait_tag = NIL`
   - `t->inbox = ev` (optional)
   - Task becomes runnable in the next scheduler cycle.

**Example:**

```c
for each ev in global_queue {
  for each t in tasks {
    if (t->wait_tag == ev) {
      t->wait_tag = NIL;
      t->inbox = ev;
      // note: do not break if broadcast mode enabled
    }
  }
}
```

### 5.5 Scheduler Interaction

The scheduler’s main loop recognizes three task states:

- **Runnable:** `wait_tag == NIL && return_code == NIL` → eligible for execution.
- **Blocked:** `wait_tag != NIL && return_code == NIL` → skipped.
- **Terminated:** `return_code != NIL` → skipped (slot free for SPAWN).

This simple tri-state model ensures the scheduler’s scan is O(N) with small N.

### 5.6 Fairness and Starvation Freedom

- **Round-Robin Guarantee:** Each runnable task receives execution in strict cyclic order.
- **Blocking Fairness:** Since tasks do not hold CPU when blocked, runnable tasks cycle consistently.
- **Timeouts for Long Computations:** Programmers can inject periodic `YIELD` calls to avoid long monopolies.

### 5.7 Deadlock Detection and Recovery

While Tacit prevents many deadlocks by design, circular waits can occur (e.g., Task A waits on B, B waits on A). Strategies:

- **Static Analysis (Offline):** Detect cycles in `WAIT_TASK` relationships.
- **Runtime Watchdog:** A monitor task tracks time since last progress; on excessive stall, logs deadlock.
- **Recovery Hooks:** Offer `ABORT` or `RESET` commands to terminate stuck tasks.

### 5.8 Priority Inversion and Avoidance

Although tasks are equal priority, inversion can occur when a high-frequency task depends on a slow I/O task. Solutions:

- **Priority Tags:** Assign numeric priority in `flags`; dispatcher checks high-priority tasks first.
- **Boosting:** Temporarily elevate priority of tasks holding key resources.
- **Deadline Scheduling:** Extended scheduler can incorporate timing constraints.

### 5.9 Cooperative Preemption Heuristics

Tasks can call `YIELD` after N instructions to voluntarily preempt:

```forth
; Pseudocode function
: long_compute ( n -- )
  BEGIN
    DUP 0 >
  WHILE
    DO_HEAVY_WORK
    YIELD            ; preemptability point
    1-               ; decrement loop counter
  REPEAT
;
```

Configurable heuristics:

- **Instruction Count:** yield every K operations.
- **Time Slice:** optional high-resolution timer triggers synthetic `YIELD` events.

### 5.10 Metrics and Instrumentation

- **Counters:** track `blocks`, `unblocks`, `avg_block_time` per task.
- **Histograms:** record distribution of block durations.
- **Event Logs:** record each `WAIT` and its matching event.

### 5.11 Example Workflow: Producer-Consumer

```forth
; Producer task
LOOP_PRODUCE:
  PRODUCE_DATA           ; write to buffer
  PUSH buffer_id
  WRITE_STR              ; may suspend
  JMP LOOP_PRODUCE

; Consumer task
LOOP_CONSUME:
  PUSH buffer_id
  READ_LINE              ; may suspend until line available
  PROCESS_LINE
  JMP LOOP_CONSUME
```

This canonical example demonstrates blocking on full buffer (producer) and empty buffer (consumer), with symmetric resume events.

---

## 6. System Bootstrap & Minimal Configuration (Condensed) (Updated Size)

The bootstrap process initializes Tacit’s core structures with zero dynamic allocation and deterministic memory layout:

- **Memory Layout:** Task table (32×424 B), line buffers, event queue, and aligned code/data segments at fixed addresses.
- **Hardware Initialization:** Configure system clock, UART console for diagnostics, and memory controller; disable interrupts until scheduler start.
- **Component Setup:**
  - Clear task table; assign initial tasks IPs; set `SP=RP=BP=0`; mark remaining slots free by setting non‑NIL return codes.
  - Initialize two line buffers (head=tail=0, flags=0) and event queue (head=tail=count=0).
  - Verify code segment integrity via CRC or hash; on failure, enter safe-mode diagnostic loop.
- **Scheduler Entry:**
  ```c
  void boot() {
    init_hardware();
    clear_memory();
    init_buffers();
    init_tasks();
    start_scheduler(); // does not return
  }
  ```
- **Diagnostics & Updates:** Dual-bank flash for atomic firmware swaps; optional secure boot and compression overlays.

---

## 7. Future Extensions & Deferred Features (Summary)

Anticipated enhancements include:

- **Timeout Suspension:** Timer-generated `symbol:timeout_X` events for delays.
- **Multi-Condition Waits:** `WAIT_ANY` and `WAIT_ALL` across tag vectors.
- **Broadcast & Pattern Events:** Wildcard matching and multi-receiver dispatch.
- **Enhanced SPAWN:** Resource quotas, task grouping, and dynamic priority adjustments.
- **Runtime Introspection:** APIs for live task status, event tracing, and performance counters.
- **Sequence Streams:** Lazy sequences as event sources with backpressure management.
- **Scheduler Plugins:** Deadline-based, priority-boosting, and mixed scheduling policies.
- **Local Variable Enhancements:** Support for different local types, initializers, or limited block scoping within functions (though still tied to the single stack frame).

---

# Conclusion

This specification delivers a concise yet comprehensive blueprint for the Tacit VM, balancing essential implementation details with extensibility. All core and planned features are defined to guide a deterministic, low-footprint, cooperative virtual machine.
