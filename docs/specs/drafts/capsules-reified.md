# TACIT Capsule Construction via Unified Stack Frame Transfer

## Table of Contents

1. Introduction and Motivation
2. Stack Model Overview
3. Local Variable Frames and Stack Layout
4. Capsule Construction as Frame Transfer
5. Dispatch Tables and Method Binding
6. Method Execution Context
7. Field Access and Unified Slot Semantics
8. Managing Stack Direction and Memory Layout
9. Entry Point, Dispatch Identification, and BP Linking
10. Constraints and Assumptions
11. Re-Entrancy, Function Calls, and Isolation
12. Final Remarks and Future Directions

---

## 1. Introduction and Motivation

Tacit traditionally distinguishes between local variables, used during function execution, and object fields, stored in capsules. This separation necessitated parallel systems for slot assignment, access semantics, and lifetime management. However, recent developments have shown that this division may be unnecessary and, in fact, unhelpful.

This document formalises the unification of fields and local variables into a single concept: a variable slot, addressable through a shared mechanism regardless of whether the frame is active (local execution) or captured (capsule). In essence, capsule construction is reduced to a transformation: converting a function-local stack frame into a durable data structure with a dispatch map.

By allowing the same opcodes to reference variables or fields depending on the runtime context, the capsule becomes an object in the full sense—immutable in structure but dynamically dispatchable.

This approach simplifies compiler implementation, eliminates dual slot systems, and brings field access into alignment with stack-local logic, using only one register (the base pointer, or BP) and a minimal dispatch-mode flag.

---

## 2. Stack Model Overview

Tacit uses two main stacks: a return stack for function control flow and local variables, and a data stack for values and list-based composition. Each stack grows in one direction—typically upward—but may be reversed in certain implementations.

The return stack is used to allocate space for local variables. A base pointer (BP) is set at function entry, providing a stable reference point for indexing local slots. The slots are populated in declaration order, and opcodes like `varref` use relative offsets from BP.

The data stack, by contrast, is used for holding runtime values—simple and compound—including lists and capsules. It does not preserve variable bindings or stack frames unless explicitly constructed to do so.

To unify these models, the return stack frame must be transferred into the data stack in such a way that it remains addressable via the same slot-indexing logic. This requires the insertion of a BP link into the data stack structure.

---

## 3. Local Variable Frames and Stack Layout

In standard function execution, local variables are declared at the top level of the function. Each declaration allocates a slot in the return stack frame. Slot numbers are assigned in order, starting from 0.

For example:

```
3 var a
5 var b
```

This declares two variables `a` and `b`. The stack frame will contain their values in order, and `a` will be at BP+0, `b` at BP+1.

These variables can be accessed using opcodes that use immediate slot numbers compiled during forward compilation. This guarantees zero-overhead indexing.

During function execution, this BP remains constant. Nested blocks do not create new frames; they use the current one. Only full function calls push new frames onto the return stack.

---

## 4. Capsule Construction as Frame Transfer

To construct a capsule, we use the existing local variable frame, then 'snap' it off and reify it as a data structure.

This process includes:

* Copying the entire local frame from the return stack into the data stack.
* Inserting a base-pointer link at a fixed slot (typically the first or second element).
* Copying the dispatch table (a map list structure) as the first or second element, depending on conventions.
* Wrapping the resulting structure into a list, producing a tagged capsule.

No slot renumbering occurs. The variable offsets used during method compilation remain valid. Only the address base changes—from return stack BP to a pointer inside the data stack.

This allows opcodes like `varref` to function identically—whether inside a function or a capsule method—provided the dispatch machinery updates BP accordingly.

---

## 5. Dispatch Tables and Method Binding

Capsules include a dispatch table—usually as a map list structure—stored at a fixed location within the capsule.

This map list includes key-code pairs, e.g.:

```
{ next { a b + } reset { 0 -> a } }
```

Each code block is compiled at the same time as the capsule and has access to the same variable slots declared in the constructor function.

Importantly:

* Method blocks are compiled when the capsule is declared.
* They use the same `varref` opcode as normal function code.
* At runtime, the BP register is set to the capsule's internal slot base.

Thus, methods are not closures—they do not capture external context. Instead, they are bound to a reified stack frame, allowing fast, pointer-based access.

---

## 6. Method Execution Context

Calling a method is done via a `dispatch` operator, which takes:

1. The capsule (a list)
2. A symbol (or a list with symbol + arguments)

`dispatch` performs:

* Lookup in the map list (dispatch table).
* Retrieval of the associated code block.
* Setting BP to the internal slot table (using the stored pointer).
* Execution of the code block.

During this time:

* The return address is pushed to the return stack.
* The previous BP is saved.
* The dispatch-mode flag is set.

After the method returns, BP and the flag are restored. This allows nesting of dispatches and normal function calls.

---

## 7. Field Access and Unified Slot Semantics

There is no longer any semantic difference between a local variable and a field.

Both are:

* Declared using `var` during the constructor.
* Accessed using `varref` (or similar) with slot numbers.
* Stored in a flat frame.

This unification eliminates the need for dual access paths or field-specific compilation. Methods treat the capsule’s slot table as if it were their local frame.

The only difference is that capsules persist and methods share the same frame, while function locals are ephemeral and isolated.

---

## 8. Managing Stack Direction and Memory Layout

The return stack grows upward. Local variables are added from BP+0 to BP+n.

The data stack also grows upward. However, when transferring a frame from the return stack to the data stack, we must preserve variable order. To achieve this:

* The frame is copied in order.
* A link is added at the head pointing to the base (BP-equivalent).
* The dispatch table is inserted at a fixed position (e.g. element 0).

If necessary, we can reverse the copy order to match expectations, or simply adjust BP to account for reverse addressing.

Future designs may allow for downward-growing stacks or reversed frame layouts, but this is not required.

---

## 9. Entry Point, Dispatch Identification, and BP Linking

When entering a method via `dispatch`, the runtime must:

* Locate the capsule’s base-pointer-equivalent.
* Set BP to that address.
* Optionally flag that we are in dispatch mode.

This flag may control varref behaviour if subtle differences emerge, e.g. if capsule slots need reversed indexing. In most cases, simply using BP and matching frame layout is sufficient.

The capsule structure is thus:

```
[ dispatch-map BP-link slot0 slot1 slot2 ... ]
```

* `dispatch-map` is typically element 0.
* `BP-link` is element 1.

---

## 10. Constraints and Assumptions

* Capsules must not contain compound elements in their slot table unless explicitly supported.
* Slot count must be preserved during transfer.
* Methods must not refer to undeclared variables.
* Capsules are immutable in structure after construction.
* BP and IP must be properly restored after dispatch.

These constraints ensure capsule semantics are predictable and safe.

---

## 11. Re-Entrancy, Function Calls, and Isolation

Methods are not re-entrant: they share the same slot table.

However, methods can call normal functions, which will push new frames.

During a method:

* BP points to the capsule.
* A function call pushes IP and BP.
* A new BP is set for that function.
* Upon return, the capsule’s BP is restored.

Thus, capsules isolate their slot state, but allow standard function nesting.

Dispatches can be nested if they restore BP and IP properly. Self-dispatch is supported by reusing the current BP.

---

## 12. Final Remarks and Future Directions

This unified model simplifies compiler logic, reduces opcode diversity, and allows for powerful object-like behaviour without closures or heap allocation.

Future work may explore:

* Shallow copies of capsules.
* Slot mutability rules.
* Reversed-stack data models.
* Capsule type metadata.

For now, the model described here provides a compact, coherent way to represent methods and state within a stack-based language without introducing external memory or reference semantics.
