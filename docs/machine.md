# Implementation Status: Future Specification
- This document outlines the planned bytecode architecture
- Currently partially implemented in the codebase

---

**TACIT BYTECODE COMPILATION MODEL — PORTABLE SUMMARY**

This document outlines the design intent and structure for compiling Tacit source code into a low-level bytecode format, specifically targeting constrained environments such as microcontrollers (e.g., ESP32). This bytecode is not intended for direct human authoring—it is an efficient, machine-level representation of Tacit programs and sequences.

---

**1. PURPOSE**

The Tacit bytecode format is designed to:

* Represent sequence chains, mapping, folding, and conditionals at a low level.
* Support a stack-based execution model, consistent with Tacit's RPN syntax.
* Enable compact encoding for controller deployment, minimizing RAM/ROM usage.
* Support multitasking and yielding efficiently within the Tacit virtual machine.
* Allow fast, single-pass compilation from Tacit source code to VM-executable code.

---

**2. GENERAL CHARACTERISTICS**

* Stack-based: All operands are passed via an implicit data stack.
* No closures or environments: All functions are stateless or operate on the stack.
* Linear control flow with jump support: Allows branching and looping constructs at the bytecode level, even if Tacit syntax avoids explicit loops.
* Bytecode is not human-readable and is never used directly in Tacit source.

---

**3. CORE OPCODE SET (MINIMAL)**

**Stack Operations:**

* `PUSH_CONST val` — Push literal constant
* `DUP` — Duplicate top of stack
* `DROP` — Discard top of stack
* `SWAP`, `OVER`, `ROT` — Stack manipulation primitives

**Arithmetic and Logical Ops:**

* `ADD`, `SUB`, `MUL`, `DIV`
* `EQ`, `NE`, `GT`, `LT`, `GTE`, `LTE`
* `AND`, `OR`, `NOT`

**Control Flow:**

* `JMP offset` — Unconditional jump
* `JZ offset` — Jump if top of stack is false (zero/NIL)
* `JNZ offset` — Jump if top of stack is true
* `CALL index` — Call a compiled function
* `RET` — Return from function

**Sequence and Iterator Support:**

* `SEQ_INIT` — Initialize a sequence (e.g., from a vector or range)
* `SEQ_NEXT` — Yield next value from a sequence; returns a done flag
* `SEQ_APPEND` — Append a value to an internal buffer
* `SEQ_REALIZE` — Finalize sequence and push it
* `SEQ_MAP` — Apply function to each element
* `SEQ_FOLD` — Reduce sequence with an accumulator
* `SEQ_MASK` — Apply boolean mask sequence to another sequence

**Frame and Local Storage (optional):**

* `FRAME_ENTER n` — Reserve space for n locals
* `FRAME_EXIT` — Pop locals
* `LOAD index` / `STORE index` — Read/write from local frame

**System and Multitasking:**

* `YIELD` — Cooperative task yield
* `SUSPEND` / `RESUME` — Placeholder for multitasking control
* `HALT` — End of execution

---

**4. CONTROL MODEL**

* Bytecode supports conditional branching and computed jumps.
* Loop-like behavior (e.g., sequences) is handled using `SEQ_NEXT` and conditional jumps.
* Sequence combinators like `each`, `fold`, and `mask` can be inlined or dispatched via specialized opcodes.
* No dynamic code evaluation or loading—everything is compiled ahead of time.

---

**5. COMPILATION STRATEGY**

* Tacit source is compiled into linear bytecode functions.
* Colon definitions are compiled into their own bytecode blocks.
* Inline blocks (used in `map`, `fold`, etc.) are compiled as callable bytecode functions with known indices.
* All control flow, including sequence termination, conditional evaluation, and error handling, is expressed using jump and flag patterns.

---

**6. YIELDING AND MULTITASKING**

* Sequences and long-running tasks are expected to insert `YIELD` at safe points.
* A simple cooperative task scheduler can use these yield points to manage multiple flows without preemption.
* Sequence iteration (e.g., inside `each`) is a natural yield boundary.
* Retry or IO primitives may also yield to allow non-blocking execution.

---

**7. EMBEDDED EXECUTION TARGETS**

* Designed to run efficiently on devices like the ESP32.
* Execution engine can be implemented in C or minimal assembly.
* Bytecode blobs can be compiled on a host (e.g., laptop) and uploaded to the device.
* Alternatively, a small Tacit interpreter on the MCU can load and run scripts self-hostedly.

---

**8. FUTURE DIRECTIONS**

* Formal definition of bytecode encoding (e.g., instruction layout, operand packing)
* Optional static typing annotations to enable early validation
* Integration with persistent storage, event handling, and device-specific drivers
* Compressed bytecode formats for large scripts

---

**SUMMARY**

Tacit's bytecode format provides a low-level, efficient, and compact compilation target that reflects its core model: forward-only sequences, stack-based computation, and declarative control. It avoids runtime dynamic features in favor of predictable behavior and minimal VM complexity—ideal for embedded systems and constrained environments.

---

Let me know if you’d like a companion document that defines how to compile Tacit’s high-level syntax into this bytecode format, or one that maps specific sequence operations (`each`, `fold`, `mask`, etc.) into bytecode layouts.
