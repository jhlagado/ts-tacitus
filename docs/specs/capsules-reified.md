# Tacit Capsule Construction via Unified Stack Frame Transfer

## Table of Contents

1. Introduction and Motivation
   - Why Unify Locals and Fields?
2. Stack Model Overview
3. Local Variable Frames and Stack Layout
4. Capsule Construction as Frame Transfer
   - Example: Capsule Construction Walkthrough
5. Dispatch Tables and Method Binding
   - Example: Method Dispatch
6. Method Execution Context
7. Field Access and Unified Slot Semantics
   - Mutation Scenarios
8. Managing Stack Direction and Memory Layout
9. Entry Point, Dispatch Identification, and BP Linking
10. Constraints and Assumptions
    - Capsule Mutation Rules (Expanded)
11. Re-Entrancy, Function Calls, and Isolation
    - Example: Recursive Method
12. Final Remarks and Future Directions
13. Implementation Guidance
    - Pseudocode: Capsule Construction
    - Pseudocode: Method Dispatch
    - Edge Case Handling
14. Testing and Validation
    - Test Checklist (Expanded)
    - Example Test Case
15. Advanced Patterns
    - Capsule Composition
    - Simulating Inheritance
    - Capsule Type Metadata
16. User Guidance
    - Best Practices
    - Common Pitfalls
    - Migration Notes

---

## 1. Introduction and Motivation

Tacit traditionally distinguishes between local variables, used during function execution, and object fields, stored in capsules. This separation necessitated parallel systems for slot assignment, access semantics, and lifetime management. However, recent developments have shown that this division may be unnecessary and, in fact, unhelpful.

This document formalises the unification of fields and local variables into a single concept: a variable slot, addressable through a shared mechanism regardless of whether the frame is active (local execution) or captured (capsule). In essence, capsule construction is reduced to a transformation: converting a function-local stack frame into a durable data structure with a dispatch map.

By allowing the same opcodes to reference variables or fields depending on the runtime context, the capsule becomes an object in the full sense—immutable in structure but dynamically dispatchable.

This approach simplifies compiler implementation, eliminates dual slot systems, and brings field access into alignment with stack-local logic, using only one register (the base pointer, or BP) and a minimal dispatch-mode flag.

### Why Unify Locals and Fields?

Historically, Tacit maintained separate systems for local variables and object fields, leading to duplicated logic and subtle bugs. By unifying these into a single slot model, we:

- Eliminate dual access paths and slot numbering confusion
- Enable direct, zero-overhead access for both locals and fields
- Simplify compiler and runtime logic
- Make mutation and lifetime rules explicit and predictable

This approach is inspired by stack-based object models in Forth and concatenative languages, but with stricter type safety and memory discipline.

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

- Copying the entire local frame from the return stack into the data stack.
- Inserting a base-pointer link at a fixed slot (typically the first or second element).
- Copying the dispatch table (a map list structure) as the first or second element, depending on conventions.
- Wrapping the resulting structure into a list, producing a tagged capsule.

No slot renumbering occurs. The variable offsets used during method compilation remain valid. Only the address base changes—from return stack BP to a pointer inside the data stack.

This allows opcodes like `varref` to function identically—whether inside a function or a capsule method—provided the dispatch machinery updates BP accordingly.

### Example: Capsule Construction Walkthrough

Suppose we have a function:

```
3 var a
5 var b
{ next { a b + } reset { 0 -> a } }
capsule
```

At runtime, the local frame is:

| BP+0 | BP+1 |
| ---- | ---- |
| 3    | 5    |

Capsule construction copies these slots to the data stack, inserts a BP link, and attaches the dispatch table. The resulting structure:

```
[ dispatch-map BP-link 3 5 ]
```

The dispatch table is a map list, e.g. `{ next { a b + } reset { 0 -> a } }`.

No renumbering occurs; method code compiled with slot offsets remains valid.

---

## 5. Dispatch Tables and Method Binding

Capsules include a dispatch table—usually as a map list structure—stored at a fixed location within the capsule.

This map list includes key-code pairs, e.g.:

```
{ next { a b + } reset { 0 -> a } }
```

Each code block is compiled at the same time as the capsule and has access to the same variable slots declared in the constructor function.

Importantly:

- Method blocks are compiled when the capsule is declared.
- They use the same `varref` opcode as normal function code.
- At runtime, the BP register is set to the capsule's internal slot base.

Thus, methods are not closures—they do not capture external context. Instead, they are bound to a reified stack frame, allowing fast, pointer-based access.

### Example: Method Dispatch

Given a capsule as above, calling `dispatch` with `next`:

```
capsule `next dispatch
```

1. Looks up `next` in the dispatch table
2. Sets BP to the capsule's slot table
3. Executes `{ a b + }` with BP pointing to `[3 5]`
4. Returns the result

Recursive dispatch is supported:

```
capsule `next dispatch   \ can call itself recursively
```

---

## 6. Method Execution Context

Calling a method is done via a `dispatch` operator, which takes:

1. The capsule (a list)
2. A symbol (or a list with symbol + arguments)

`dispatch` performs:

- Lookup in the map list (dispatch table).
- Retrieval of the associated code block.
- Setting BP to the internal slot table (using the stored pointer).
- Execution of the code block.

During this time:

- The return address is pushed to the return stack.
- The previous BP is saved.
- The dispatch-mode flag is set.

After the method returns, BP and the flag are restored. This allows nesting of dispatches and normal function calls.

---

## 7. Field Access and Unified Slot Semantics

There is no longer any semantic difference between a local variable and a field.

Both are:

- Declared using `var` during the constructor.
- Accessed using `varref` (or similar) with slot numbers.
- Stored in a flat frame.

This unification eliminates the need for dual access paths or field-specific compilation. Methods treat the capsule’s slot table as if it were their local frame.

The only difference is that capsules persist and methods share the same frame, while function locals are ephemeral and isolated.

### Mutation Scenarios

- Simple slot update:
  - `10 -> a` updates field `a` in place
- Compound slot replacement:
  - `(1 2 3) -> b` replaces field `b` if it is a compound of length 3
- Error case:
  - `(1 2) -> b` fails if `b` is a compound of length 3

Mutation is allowed as long as slot compatibility is maintained.

---

## 8. Managing Stack Direction and Memory Layout

The return stack grows upward. Local variables are added from BP+0 to BP+n.

The data stack also grows upward. However, when transferring a frame from the return stack to the data stack, we must preserve variable order. To achieve this:

- The frame is copied in order.
- A link is added at the head pointing to the base (BP-equivalent).
- The dispatch table is inserted at a fixed position (e.g. element 0).

If necessary, we can reverse the copy order to match expectations, or simply adjust BP to account for reverse addressing.

Future designs may allow for downward-growing stacks or reversed frame layouts, but this is not required.

---

## 9. Entry Point, Dispatch Identification, and BP Linking

When entering a method via `dispatch`, the runtime must:

- Locate the capsule’s base-pointer-equivalent.
- Set BP to that address.
- Optionally flag that we are in dispatch mode.

This flag may control varref behaviour if subtle differences emerge, e.g. if capsule slots need reversed indexing. In most cases, simply using BP and matching frame layout is sufficient.

The capsule structure is thus:

```
[ dispatch-map BP-link slot0 slot1 slot2 ... ]
```

- `dispatch-map` is typically element 0.
- `BP-link` is element 1.

---

## 10. Constraints and Assumptions

#### Definition: Compatibility for Compound Mutation

Compatibility means that a compound value (such as a list or maplist) may be assigned to a capsule slot only if its **slot count** (total number of 32-bit cells, including header and payload) exactly matches the slot count of the existing value in that slot. This ensures safe, in-place replacement without altering the capsule’s structure or memory layout.

For example, if a slot contains a list occupying 4 cells (1 header + 3 payload), only another list of 4 cells may be assigned to it. Attempting to assign a compound of different slot count is an error and must be rejected.

#### Examples

- Assigning `(1 2 3)` (4 cells) to a slot containing `(4 5 6)` (4 cells) is allowed.
- Assigning `(1 2)` (3 cells) to a slot containing `(4 5 6)` (4 cells) is an error.
- Assigning a maplist of 5 cells to a slot containing a maplist of 5 cells is allowed.
- Assigning a list to a slot containing a maplist (even if slot count matches) is not allowed; type must also match.

This rule applies to all compound mutation operations in capsules.

These constraints ensure capsule semantics are predictable and safe, while allowing controlled mutation of field values.

### Capsule Mutation Rules (Expanded)

- Simple values (numbers, booleans, symbols) can be updated in place
- Compound values (lists, maplists) can be replaced by new compounds of the same length
- Assignment to incompatible compound slots is an error
- Capsule structure (slot count, field names) is immutable after construction
- Dispatch table and BP link are fixed

---

## 11. Re-Entrancy, Function Calls, and Isolation

### Method Re-Entrancy and Recursion

While all methods on a capsule share the same slot table (fields), **recursive or nested method calls on the same capsule are supported** via the dispatch mechanism. When a method dispatches to itself (or another method on the same capsule), the return stack correctly tracks the call chain, and the data stack is available for temporary storage needed for recursion. There are no local variables beyond the capsule fields, but recursive algorithms and re-entrant method calls are possible as long as mutation of shared fields is managed carefully by the programmer.

Capsules isolate their slot state, but allow standard function nesting and recursive dispatch. Dispatches can be nested if BP and IP are properly saved and restored. Self-dispatch is supported by reusing the current BP.

### Example: Recursive Method

Suppose a method `factorial` is defined in a capsule:

```
{ factorial { n fetch 1 le { 1 } { n fetch n fetch 1 sub factorial mul } if } }
```

Calling `capsule `factorial dispatch` will recursively dispatch on the same capsule, with the return stack unwinding correctly.

---

## 12. Final Remarks and Future Directions

This unified model simplifies compiler logic, reduces opcode diversity, and allows for powerful object-like behaviour without closures or heap allocation.

Future work may explore:

- Shallow copies of capsules.
- Slot mutability rules.
- Reversed-stack data models.
- Capsule type metadata.

For now, the model described here provides a compact, coherent way to represent methods and state within a stack-based language without introducing external memory or reference semantics.

## 13. Implementation Guidance

### Pseudocode: Capsule Construction

```
function constructCapsule(frameSlots, dispatchTable) {
	bpLink = ... // pointer to slot base
	capsule = [dispatchTable, bpLink, ...frameSlots]
	return capsule
}
```

### Pseudocode: Method Dispatch

```
function dispatch(capsule, symbol) {
	codeBlock = capsule.dispatchTable[symbol]
	saveBP = BP
	BP = capsule.slotBase
	result = execute(codeBlock)
	BP = saveBP
	return result
}
```

### Edge Case Handling

- Nested dispatch: always save/restore BP and IP
- Self-dispatch: reuse current BP
- Error recovery: raise error on incompatible slot assignment

## 14. Testing and Validation

### Test Checklist (Expanded)

- Capsule construction: correct slot transfer, BP link, dispatch table
- Method dispatch: BP management, slot access, recursion
- Mutation: simple and compound slot updates, error cases
- Edge cases: nested dispatch, self-dispatch, error recovery

### Example Test Case

```
capsule = constructCapsule([3, 5], { next: codeBlock })
result = dispatch(capsule, 'next')
assert(result == 8)
```

## 15. Advanced Patterns

### Capsule Composition

- Shallow copy: create new capsule with same slot values
- Slot compatibility: ensure compound slots match in length/type

### Simulating Inheritance

- Use composition: include parent capsule slots in child
- Dispatch table can delegate to parent methods

### Capsule Type Metadata

- Add type tags or metadata fields for future extensibility

## 16. User Guidance

### Best Practices

- Declare all needed fields up front
- Use compatible compound types for mutation
- Avoid relying on external context in methods

### Common Pitfalls

- Assigning incompatible compound values
- Forgetting to save/restore BP in custom dispatch logic
- Expecting closure-like behavior (not supported)

### Migration Notes

- Previous models with dual slot systems should migrate to unified slot logic
- Review method code for slot access patterns
