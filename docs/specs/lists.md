# edit plan 
the following points are to be integrated into the # TACIT Lists document below

---

Proposed Edit Plan — lists.md

1. Terminology cleanup

Replace “All values (scalars and compound values) occupy one 32-bit cell” with:

> All stack slots are 32-bit cells. Simple values occupy one slot. Compound values occupy multiple slots (their header plus payload slots).



Add definitions:

Cell: 32-bit memory unit (anywhere).

Slot: cell addressed relative to a list’s payload.

Element: logical member of a list (simple = 1 slot; compound = header + payload).

Simple / Compound: as above; a list is one compound type.



2. Two lengths

Explicitly distinguish:

slots(list) — O(1) from header (s).

elements(list) — O(s) traversal.


Note: elements can’t be randomly accessed without traversal.


3. Prepend / append semantics

Clarify: prepend is in-place O(1) and encouraged; append is O(n) and discouraged.

Add front-drop as symmetric to prepend.

Remove/replace any outdated append description that implies it writes at SP-1 but calls itself “append.”


4. Mutation rules

State: only simple slots can be overwritten in place.

Overwriting compounds is disallowed; may return sentinel (implementation-defined) but not required to specify here.


5. CONS vs CONCAT

Add small note to distinguish:

CONS: prepend value (simple or compound) as single element.

CONCAT: merge elements of second list into first.

Fallback: if second arg to CONCAT is not a list, behave as CONS.



6. Length field width

Change “max slot count 65,535” to:

> Max slot count is implementation-defined; current implementation uses 16 bits in the header (max 65,535 slots) for 256 KiB payloads on 32-bit words.




7. Empty lists

Explicitly state:

LIST:0 prints as ( ).

slots() = 0, elements() = 0.

drop(LIST:0) removes 1 cell.

Prepending to empty list yields one-element list.



8. Traversal rule

State: compounds must store their total slot span in their header; traversal always advances by that span.

For lists, span = s + 1.


9. Stack pointer direction fix

Correct all instances of SP+1 for first element to SP-1 to match upward-growing stack.



---


# TACIT Lists

This document specifies the current, unified list structure in TACIT. It describes the in-memory/stack representation, literal syntax, core operations, and constraints. It does not reference deprecated formats.

## Overview

- A list is a length-prefixed, stack-native aggregate value.
- The list header is at Top-of-Stack (TOS) and stores the payload size in cells.
- The payload (list elements) occupies contiguous stack cells immediately beneath the header.
- All values (scalars and compound values) occupy one 32-bit cell on the stack.

## Literal Syntax

- Lists are written using parentheses: `( elem0 elem1 ... elemN )`.
- Nested lists are allowed: `( 1 ( 2 3 ) 4 )`.

Example:

- `( 1 2 3 )` produces a list with 3 elements.
- `( 1 ( 2 3 ) 4 )` produces a list with 3 logical elements where the second element is itself a list.

## Stack Representation

A list with slot count `s` occupies `s + 1` contiguous cells:

```
[payload cell s-1] … [payload cell 1] [payload cell 0] [LIST:s] ← TOS (SP)
```

- Header `LIST:s` is a tagged 32-bit value at TOS that stores the number of payload cells `s`.
- Payload consists of `s` tagged cells stored deepest-to-shallowest.
- Element 0 (logically first) is located at stack position `SP + 1`.

Printing example for `( 1 2 )`:
- The high-level print operator (`.`) displays `( 1 2 )`.

## Construction (Parsing)

When parsing a list literal `( … )`, TACIT:
1. Tracks the number of payload cells pushed while inside the list.
2. On `)`, emits a single header `LIST:s` where `s` equals the number of payload cells for that list.
3. Nested lists are already complete (header + payload) when the outer list closes.

This yields a compact, contiguous representation where the header is immediately available at TOS.

## Core Operations (Conceptual)

The VM exposes list functionality through built-in operations and literals. The following concepts describe the behavior:

- Slot count (size): Given a list at TOS, its slot count `s` is read from the header’s payload-length field.
- Skip / drop list: Removing a list from the stack advances `SP` by `s + 1` (header plus payload).
- Prepend (O(1)): To add a value at the logical head, place the value above the header, swap back the header to TOS, and increment the slot count by 1.
- Append (O(s)): To append at the logical tail, one cell of space is made below the payload; payload shifts one cell deeper; the new value is written at `SP + 1`; the slot count increments by 1.
- Random access: Indexing walks the payload, stepping over nested compound values by their `slot + 1` span. For homogeneous simple values, stepping is 1 per element.
- Mutation: Overwriting a simple (non-compound) payload cell is allowed. Overwriting a compound element is refused and returns a nil/sentinel.

These semantics match what the tests expect for list size queries, skipping, prepend/append, random access, and set-at behavior.

## Safety and Validation

- A valid list header has tag `LIST` and a slot count `0 ≤ s ≤ 65535`.
- Operations validate stack depth before reading header or payload.
- Skip/drop must ensure that the payload span exists on the stack.

## Constraints

- Max slot count: 65,535 (fits the 16-bit field in the tagged value).
- Element cell size: 1 (uniform 32-bit cell for all values).
- Structural immutability: List shape (ordering and grouping) is not changed in-place; operations that logically alter shape construct new lists.
- Element mutation: Allowed for simple (non-compound) cells.

## Examples

- Literal creation:
  - `( )` → `LIST:0`
  - `( 1 2 3 )` → `3 2 1 LIST:3` on the stack, printed as `( 1 2 3 )`
  - `( 1 ( 2 3 ) 4 )` → payload includes a nested list; printing yields `( 1 ( 2 3 ) 4 )`

- Drop behavior:
  - Given `… x y LIST:2` at TOS, dropping the list removes the header and the two payload cells (`y`, `x`).

- Size query (conceptual):
  - Reading the header at TOS yields `s` without inspecting the payload.

This document reflects the current unified list design used by the parser, VM, and print facilities, and omits all historical formats and implementation details not present in the current system.
