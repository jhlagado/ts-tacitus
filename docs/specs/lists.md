# TACIT Forward Lists (LIST) Specification – **Slot‑Count Edition**

## Overview

TACIT **LIST** is a length‑prefixed, stack‑allocated flat structure that serves as the primary compound data type.  Lists are constructed left‑to‑right, stored contiguously, and rely on a trailing **LINK** cell for navigation when resident on the data stack.

> **Slot terminology** – Throughout this document **n** denotes the number of *stack cells (slots)* occupied by the payload, **not** the logical element count.  A nested list consumes `payload.slot + 1` cells (its header plus payload).  Using slot counts lets the VM skip entire blocks in O(1).

---

## Basic Structure

Serialized in memory a list appears as:

```text
[LIST:n] [payload‑cell 0] … [payload‑cell n‑1]
```

On the stack, however, the payload is pushed first, then the **LINK** cell, leaving the header buried:

```text
[LIST:n] payload₀ … payloadₙ₋₁ [LINK] ← TOS
   ↑                              ↑
 start of list            back‑pointer to header
```

The header encodes **n**, the total number of cells in the payload.  A consumer that knows the header address can therefore skip the entire list with one add.

---

## Stack Representation Challenge

Because the header is deep and the payload precedes it, a naïve backward walk from TOS encounters interleaved data from nested lists and multiple LINKs.  Without LINK you cannot reliably locate the correct header.

**Example**

```tacit
( 1 ( 2 3 ) 4 )
→ [LIST:5] 1 [LIST:3] 2 3 [LINK] 4 [LINK]
```

Walking upward meets `4`, `LINK`, `3`, `2`, `LIST:3` – context is lost.

---

## LINK – Stack Navigation Anchor

* **Purpose**  Back‑pointer from TOS to the matching `LIST:n` header.
* **Scope**    Stack‑only metadata – never serialized.
* **Operation** VM reads `LINK.offset`, adds it to `SP`, lands on the header.
* **Analogy**  Pascal strings (length then bytes) – traversal must start at header.

Stack layout with LINK:

```text
[LIST:n] payload₀ … payloadₙ₋₁ [LINK:‑(n+1)] ← TOS
```

The LINK cell stores a negative offset `(‑n ‑ 1)` measured in slots.

---

## Key Properties

| Property               | LIST                                              |
| ---------------------- | ------------------------------------------------- |
| **Slot‑prefixed**      | Header stores payload *slot* count `n`.           |
| **Contiguous**         | Payload cells follow header sequentially.         |
| **LINK‑anchored**      | Backward pointer allows header discovery in O(1). |
| **Flat serialization** | No internal pointers; portable image.             |
| **Word‑aligned**       | Each cell is 32 bits.                             |

---

## Safe Access Pattern

```ts
function withList(tosLink: CellPtr, fn: (header: CellPtr)=>void): void {
  const header = tosLink + tosLink.read().offset; // follow LINK
  fn(header);
}
```

Always:

1. Follow LINK to header.
2. Read `slotCount = header.slot`.
3. Traverse forward exactly `slotCount` cells.
4. Never assume `TOS‑1` belongs to your list.

---

## Constraints

* **Max slot count** 65 535 (fits 16‑bit field).
* **Structural immutability** changing payload size in place is discouraged.
* **Element mutation** single‑cell simple values may be updated in situ.
* **LINK only on stack** never serialized or stored in buffers.

---

## Stack Effects & Examples

```tacit
( )          → LIST:0 LINK                # empty list (0 slots)
( 10 20 )    → LIST:2 10 20 LINK          # two‑slot payload
( 1 ( 2 ) )  → LIST:3 1 LIST:1 2 LINK LINK
```

Nested example breakdown:

* Inner list consumes 2 slots payload + 1 header = 3 cells; outer header’s `n` therefore counts 3 cells for the inner block plus 1 for the leading value.

---

## Operations Strategy

### Slot‑Based Forward Scan

```ts
function scan(header: CellPtr, visit: (v: Value)=>void): void {
  const n = header.slot;
  let ptr = header + 1;   // first payload cell
  let remaining = n;
  while (remaining > 0) {
    const v = ptr.read();
    visit(v);
    const step = v.isCompound() ? v.slot + 1 : 1;
    ptr       += step;
    remaining -= step;
  }
}
```

### Random Access (index)

Traverse, counting only **logical elements**; costs O(totalSlots).

### Element Mutation (simple value)

1. Locate cell via traversal.
2. Overwrite tagged value.

### Structural Operations (insert, remove)

Rebuild a fresh list; update header, recalc new LINK.

---

## Mutability Semantics

| Capability                | Allowed? | Note                                         |
| ------------------------- | -------- | -------------------------------------------- |
| Overwrite simple value    | ✓        | one cell write                               |
| Append / Prepend in place | ×        | must rebuild (would invalidate LINK offsets) |
| Resize list               | ×        | structural immutability                      |

---

## Zero‑Length Lists

`LIST:0 LINK` – header followed immediately by its LINK (`offset = ‑1`).  Acts as sentinel or empty container.

---

## Implementation Notes

* **LINK generation** emitted by the list‑literal closing token after payload push.
* **LINK preservation** stack words (`swap`, `over`, etc.) must treat LINK as part of the data block they move.
* **Destruction** popping the list naturally removes LINK; nothing else required.
* **`.skip` helper** – given a LINK cell at TOS, set `SP += (‑LINK.offset)` to drop header + payload + LINK in one instruction.  Mirrors the constant‑time `.skip` used by RLIST.

---

## Performance Considerations

| Access Pattern   | Cost               |
| ---------------- | ------------------ |
| Header lookup    | O(1) (follow LINK) |
| Head element     | O(1)               |
| Tail element     | O(n)               |
| Random by index  | O(n) worst         |
| Skip entire list | O(1)               |

Because `n` is slots, homogeneous numeric lists have `n == logicalLength`; mixed or nested lists inflate `n` but preserve linear traversal.

---

## Traversal Patterns

### Index‑Based Access

```ts
function getAt(link: CellPtr, idx: number): Value | nil {
  let found: Value | nil = NIL;
  withList(link, (hd) => {
    let ptr = hd + 1;
    let remaining = hd.slot;
    let logical   = 0;
    while (remaining > 0) {
      const v = ptr.read();
      if (logical === idx) { found = v; break; }
      const step = v.isCompound() ? v.slot + 1 : 1;
      ptr       += step;
      remaining -= step;
      logical   += 1;
    }
  });
  return found;
}
```

Out‑of‑bounds returns `NIL`.

### Forward Iteration

Reuse `scan` function above; critical rule: always start from header, never walk backward from TOS.

---

## Simple vs Compound Values

* **Simple** – one cell; numbers, symbols, booleans.
* **Compound** – multi‑cell blocks (e.g., another LIST); first cell encodes `slot` for fast skip.

Operations must branch on `isCompound()` to calculate advance step.

---

## Composition Examples

* **Homogeneous simple list** `( 1 2 3 4 )` → linear numeric array (`n == 4`).
* **Heterogeneous** `( 1 "text" `"sym`" )` – scan must tag‑check each cell.
* **Nested** lists encode trees; each subtree is contiguous `[LIST:n] … LINK` block.

---

## Construction Strategies

### Literal Build (parser)

* Push placeholder LINK.
* Push elements as encountered.
* Compute slot count `n` (cells pushed).
* Write header at beginning of block.
* Overwrite placeholder with proper negative offset.

### Programmatic Build

Accumulate elements in temp buffer; emit final list header + payload + LINK in one pass.

### Concatenation

1. Allocate new buffer sized `n₁ + n₂` slots.
2. Copy payload of first list (forward).
3. Copy payload of second list.
4. Emit header (`n₁+n₂`) and LINK.

---

## Performance Summary

| Operation      | LIST (slot‑count) |
| -------------- | ----------------- |
| Header lookup  | 1 load            |
| Prepend        | O(n) (rebuild)    |
| Append         | O(n)              |
| Skip           | O(1)              |
| Extra metadata | +1 LINK           |

Forward LIST favours tail operations if you rebuild; RLIST favours head operations.  Choice depends on workload.

---

## Buffer Serialization

A LIST stored in memory is already `[header payload]` without LINK.  Copying stack block to buffer therefore **omits LINK** and preserves forward order.

*From stack → buffer*

1. Follow LINK to header.
2. Copy `header` + `payload` (`n+1` cells) as raw block.

*From buffer → stack*

1. Copy block onto stack.
2. Append new LINK cell (`offset = ‑(n+1)`).

Cost O(n) in both directions.

---

## Error Handling

| Condition                 | Result           |
| ------------------------- | ---------------- |
| Out‑of‑bounds index       | `NIL`            |
| Mutation of compound cell | `NIL` or ignored |

No exceptions; NIL propagates like `0`.

---

## Implementation Checklist

1. **Confirm tag field interpretation** – `n` = slot count.
2. **Parser update** – ensure LINK offset uses `n+1`.
3. **Library helpers** – `.slot`, `.followLink`.
4. **Docs** – sync capsule & maplist specs.
5. **Tests** – nested structure skip, buffer round‑trip, mutation rules.

---

## Related Specs

* `docs/specs/rlists.md` – reverse list alternative
* `docs/specs/tagged-values.md` – NaN‑boxing tag system
* `docs/specs/maplists.md` – associative structures
* `docs/specs/capsules.md` – object model on lists
* `docs/specs/stack-operations.md` – stack manipulation primitives

---

*End of TACIT Forward Lists (slot‑count) Specification*
