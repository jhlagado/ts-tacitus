Capsules and reify — Tacit Specification (Draft)

1. Overview

1.1 Motivation

Tacit capsules let a function suspend itself mid‑execution and return a self‑contained object that can later be resumed.  A capsule:

Preserves local variables and their values

Captures a reentry point (a code pointer)

Presents itself as a list value on the data stack


This enables rich behaviors such as:

Objects and actors with private state

Generators and coroutines that yield and resume

Pipelines and asynchronous tasks


reify is the primitive that makes this possible.  It is analogous to new in JavaScript or to creating a closure in functional languages, but explicitly stack‑based.

1.2 Key Properties

Property	Meaning

Value-first	A capsule is a first-class list value
Self-contained	Includes code pointer, locals, and metadata
Deterministic	All memory is on Tacit’s stacks; no heap allocation
Message-driven	External code interacts by dispatching messages



---

2. Conceptual Model

A capsule is a frozen function frame.  Think of it as pausing a function at a marked point, then turning the paused frame into a data structure that can later wake up and continue.

caller → call function → run initialisation … reify → capsule
capsule → dispatch → method → (optional reify again)

2.1 Lifecycle Summary

1. Creation: a function executes some initialization code, declares locals, and then calls reify.


2. Reification: reify copies the live stack frame (locals and BP) to the data stack as a list, and stores a code pointer to the reentry point at element 0.


3. Use: the capsule can be stored, passed, or queued like any other Tacit value.


4. Dispatch: when a message is sent (via dispatch), the VM sets BP to the capsule’s locals and jumps to the stored code pointer.


5. Mutation: any state change must happen through locals inside the capsule during dispatch.


6. Destruction: when no references remain, the capsule is dropped with ordinary stack semantics.




---

3. reify Operation

3.1 Purpose

reify marks a breaking point in a function.  Execution up to that point sets up the capsule’s internal state.  At reify, Tacit:

Freezes the current locals frame

Stores the current instruction pointer as a reentry point

Builds a list value with code pointer at element 0 and the captured frame as the payload

Returns that list on the data stack


The calling function does not continue; instead, its frozen self becomes a value.

3.2 Analogy

In JavaScript, new constructs an object and runs an initializer.

In Tacit, reify is the constructor: it converts the current frame into a capsule value.


3.3 Stack Effect

( ...locals... -- capsule )

Inputs: all locals are already allocated on the return stack. Output: a list value representing the capsule.


---

4. Capsule Structure

4.1 Layout

A capsule is a Tacit list with the following canonical layout:

Index	Contents

0	Code pointer (Tag.CODE) to the reentry point
1..n	Local variables captured from the function frame


The list header encodes the total span (header + all payload slots).

Locals preserve order and are addressed via the usual BP-relative rules.


4.2 Integration with VM Architecture

Data Segment: The capsule lives entirely in the data stack segment (SEG_STACK).

References: Local slots inside may contain STACK_REF or RSTACK_REF; all are valid within the capsule’s lifetime.

BP (Base Pointer): On dispatch, BP is rebound to the start of the capsule’s frame so that local variables are accessible as if the function had never returned.


4.3 Immutability of Shape

The capsule’s outer span never changes.  Internal locals may mutate in place, but the header and total slot count are fixed.  This guarantees O(1) compatibility checks and safe in-place updates.


---

5. Dispatch and Message Passing

5.1 Philosophy

Dispatch is convention-based.  The VM provides only a single primitive:

( message &capsule -- result ) dispatch

message can be any Tacit value: a symbol, number, list, or even nothing at all.

The capsule decides how to interpret it.  Common patterns include:

Symbols like init, next, destroy

Structured messages (lists or maplists)

Pure data streams with no symbol



5.2 Inside the Capsule

When dispatch is called:

1. BP is set to the capsule’s saved frame.


2. The saved code pointer (element 0) is jumped to.


3. The method reads its arguments directly from the data stack in natural reverse order.


4. Control structures inside the capsule (e.g. a maplist or future switch) decide how to route the message.



5.3 Example

: makepoint
    var y var x
    reify
    (
        `move { +> y  +> x }
        `draw { x y native_draw }
    ) maplist
;

100 100 makepoint var p1
10 10 `move &p1 dispatch
`draw &p1 dispatch

This creates a makepoint capsule with private x and y. Messages like `move and `draw are interpreted internally.


---

6. Mutation and Encapsulation

6.1 Mutation Rules

Only locals inside the capsule may be mutated.

Mutation is done via stack operations such as +> or ->.

No direct external access to locals is allowed.


6.2 Example: Increment

1 +> x   # Equivalent to x 1 add -> x but concise

This increments local x by 1 entirely inside the capsule.

6.3 Benefits

Strong encapsulation: external code cannot break invariants.

Predictable lifetimes: everything lives on the stack.

Easy persistence: the entire capsule is a single list value.



---

7. Advanced Usage

7.1 Generators

A generator capsule can interpret messages like next or restart, maintaining its own internal iteration state.

7.2 Actors or Servers

Capsules can implement server-like actors, processing incoming messages in a loop, updating state, and sending replies.

7.3 Composition

Capsules can store other capsules as fields, enabling hierarchical or modular designs.


---

8. Integration with Other Specs

8.1 References

Capsules may contain STACK_REF or RSTACK_REF values.

load and fetch behave exactly as defined in refs.md.

All aliasing and lifetime rules remain in force.


8.2 Lists

Capsules are lists.  All operations in lists.md apply.

The span of the capsule equals the total number of slots (header + all locals + code pointer).

Structural operations like concat or cons are allowed only if they preserve the header span.


8.3 Local Variables

All locals are declared with var as usual.

reify captures their exact layout and stores BP for later reentry.

Access inside methods remains standard BP-relative.



---

9. Optional Conventions

Tacit deliberately does not prescribe method names.  However, these are common:

init — called immediately after construction

destroy — clean up resources

next — for generators

default — maplist fallback when no symbol matches


Developers are free to invent their own patterns.


---

10. Summary of Invariants

1. Outer span is immutable


2. All state lives in locals inside the capsule


3. Mutation only through dispatch


4. BP is correctly restored on every dispatch


5. Dispatch arguments are unconstrained


6. Capsule is a list value and follows all list rules




---

11. Implementation Notes

11.1 VM Changes

Add reify opcode: copies the active return stack frame to the data stack and pushes a code pointer.

Add dispatch opcode: sets BP to capsule frame and jumps to code pointer.


11.2 Memory Management

Capsules are pure stack values.  No heap or garbage collector is required.

Standard stack discipline guarantees automatic cleanup when a capsule is dropped.


11.3 Debugging and Introspection

Since a capsule is a list, you can inspect its structure using standard list operations.

Optional metadata (e.g., creation timestamp, version) may be stored as extra fields by convention.



---

12. Closing Commentary

Capsules and reify give Tacit an elegant, minimal object system:

No special heap objects — everything is a list

No hidden magic — just stacks and code pointers

Powerful composition — from generators to actors to full OO


By treating code and data symmetrically, Tacit enables message-driven, stateful programming while keeping the underlying VM simple and deterministic.

> Reify in Tacit truly means make real: turning a live function into a concrete, first-class value that can act, react, and evolve entirely on the stack.
