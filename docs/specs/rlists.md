# TACIT Reverse Lists (RLIST) Specification

## Overview

**RLIST** is a stack–native, length‑prefixed compound data structure that removes the need for a **LINK** cell by keeping the list header at **Top‑of‑Stack (TOS)** and storing the payload *in reverse order* below it.  It preserves the flat, contiguous, tagged‑value discipline of forward LISTs while optimising common head‑oriented operations (peek, prepend, skip) and saving one word of metadata per live list.

*Contrast with LIST*: in a forward list the header is buried and a trailing LINK points back; in an RLIST the header is exposed and no LINK is required.  The header’s numeric field **s** counts *stack cells* (slots), not logical elements — enabling constant‑time skip over the entire structure.

---

## Basic Structure

An RLIST occupies `s + 1` contiguous cells on the data stack.

```text
[payload‑cell s‑1] … [payload‑cell 1] [payload‑cell 0] [RLIST:s] ← TOS (SP)
```

* **Header** `RLIST:s` – tagged 32‑bit length word at `SP`.
* **Payload** – `s` 32‑bit tagged cells stored deepest‑to‑shallowest.
* **No LINK** – header is already reachable; stack unwinding is a single `SP = savedSP`.

### Visual Comparison

| Forward LIST                        | Reverse RLIST                                |
| ----------------------------------- | -------------------------------------------- |
| `[LIST:n] elem₁ … elemₙ LINK ← TOS` | `payloadₙ … payload₁ payload₀ RLIST:s ← TOS` |
| Header deep, LINK shallow           | Header shallow, no LINK                      |
| n = **element count**               | s = **slot count**                           |

---

## Stack Representation Notes

### Why Reverse Order?

1. **Header access** – operations start at `SP`; header is immediately available.
2. **Skipping / Drop** – to pop a tuple, add `s + 1` to `SP` (constant time).
3. **Prepends are O(1)** – new cell pushes above header, swap, bump `s`.
4. **Cache locality** – payload is contiguous, enabling sequential prefetch during scans.

### Trade‑offs

* **Append is O(s)** – payload must shift one cell deeper to keep header on TOS.
* **I/O boundary copy** – exporting to forward‑header buffers requires a reverse copy.

---

## Construction Algorithm (Literal Parsing)

TACIT parses tokens left‑to‑right.  For `[ … ]` literals we:

1. **Open `[`**   push current `SP` on a compile‑time stack.
2. **Parse elements**   push each element in natural order (nested `[ … ]` complete first).
3. **Close `]`**

   1. `span = SP − savedSP`   cells in payload.
   2. In‑place reverse those `span` cells (triple‑reverse or scratch copy).
   3. Push header `RLIST:span`.

Because completed inner tuples are already atomic blocks, the outer reversal never corrupts their internal order.

#### Example: `[ 1 2 [ 3 4 ] ]`

Stack evolution (`↑` = push):

| Step                  | Stack (deep → shallow)                                                        |
| --------------------- | ----------------------------------------------------------------------------- |
| start                 | …                                                                             |
| push 1                | `1`                                                                           |
| push 2                | `1 2`                                                                         |
| parse inner `[ 3 4 ]` | `1 2 3 4 RLIST:2`                                                             |
| push ] outer          | reverse 5 cells → `4 3 RLIST:2 2 1` ; push header → `4 3 RLIST:2 2 1 RLIST:5` |

`RLIST:5` reports five payload cells; traversal from header yields elements 1,2,\[3 4].

---

## Key Properties

* **Slot‑prefixed** – header stores payload size in cells (0–65 535).
* **Header at TOS** – no pointer chase; LINK eliminated.
* **Reverse payload** – logical element 0 at `SP+1`.
* **Flat, Contiguous** – all values occupy one 32‑bit cell.
* **Structurally Immutable** – length & order do not change in place.

---

## Safe Tuple Access Pattern

```pseudocode
header   = SP           // RLIST:s
payload  = header + 1
cells    = header.slot  // s
ptr      = payload
remaining = cells
while remaining > 0:
    val = *ptr
    process(val)
    step = (val is LIST/ RLIST) ? val.slot + 1 : 1
    ptr += step
    remaining -= step
```

*Element lookup at index *i* requires cumulative stepping until *i*th logical element reached; worst‑case O(s).*  For homogeneous simple‑value tuples the step is always 1, so lookup is O(i).

---

## Constraints

| Constraint         | Value                   | Rationale                        |
| ------------------ | ----------------------- | -------------------------------- |
| Max slot count     | 65 535                  | Fits 16‑bit field in NaN‑box tag |
| Element cell size  | 1                       | Uniform stack layout             |
| Structure mutation | discouraged             | keep algorithms simple           |
| Element mutation   | allowed (simple values) | efficient state updates          |

---

## Stack Effects & Examples

```tacit
[ ]            → RLIST:0                     # empty tuple
[ 1 2 3 ]      → 3 2 1 RLIST:3              # three‑value tuple
[ 1 [ 2 ] 3 ]  → 3 RLIST:1 2 1 RLIST:4      # nested example
```

### Exploded View of Nested Example

```
deep → shallow
3            payload[3] (value 3)
RLIST:1      inner header (slot 1)
2            inner payload
1            payload[1]
RLIST:4      outer header (slot 4)
```

Traversal order: 1, \[2], 3.

---

## Primitive Operation Details

### Prepend (O(1))

```pseudocode
push newVal       // newVal above header
swap               // header back to TOS
header.slot += 1
```

### Append (O(s))

1. Reserve one cell below payload (`SP -= 1`).
2. `memmove` payload (`s` cells) down by one cell.
3. Store new value at `header+1`.
4. Increment `header.slot`.

### Skip / Drop Tuple

```pseudocode
SP += header.slot + 1   // remove header+payload
```

### Random Access (index i)

Iterate through payload accumulating slot counts until logical index reached.  Homogeneous simple tuples degrade to pointer arithmetic.

---

## Mutability Semantics

| Operation               | Allowed?      | Notes                   |
| ----------------------- | ------------- | ----------------------- |
| Change element value    | Yes (simple)  | direct cell write       |
| Insert / Delete element | No (in‑place) | build new tuple         |
| Resize tuple            | No            | structural immutability |

---

## Zero‑Length Tuples

`RLIST:0` alone on the stack; no payload cells.  Useful as sentinel or builder seed.

---

## Implementation Notes

### Tagging

Define new tag `RLIST` in `tagged-values.md` with 16‑bit slot count field recycled from LIST tag encoding space.

### Literal Parser Words

* `[` – compile‑time: push `SP` marker.
* `]` – compile‑time: compute span, reverse, push header.

### Library Helpers

* `.slot` – fetch `header.slot`.
* `.skip` – `SP += header.slot + 1`.
* `.prepend`, `.append` – primitives as described above.

### Unit Tests

1. Empty, single‑value, nested tuples.
2. Prepend/append edge cases.
3. Skip correctness with heterogeneous payload.
4. Buffer round‑trip preserves logical order.

---

## Traversal & Modification Patterns

### Forward Iteration (TypeScript‑like)

```ts
function iterate(tupleHeader: CellPtr, callback: (v: Value) => void): void {
  const totalSlots: number = tupleHeader.slot; // s
  let ptr: CellPtr = tupleHeader + 1;         // first payload cell
  let remaining = totalSlots;
  while (remaining > 0) {
    const value: Value = ptr.read();
    callback(value);
    const step: number = value.isCompound() ? value.slot + 1 : 1;
    ptr       += step;
    remaining -= step;
  }
}
```

### Element Update (`setAt`, TypeScript‑like)

```ts
function setAt(tupleHeader: CellPtr, index: number, newValue: Value): Value | nil {
  const totalSlots = tupleHeader.slot;
  let ptr: CellPtr = tupleHeader + 1;
  let logical = 0;
  while (logical < index && ptr < tupleHeader + 1 + totalSlots) {
    const step = ptr.read().isCompound() ? ptr.read().slot + 1 : 1;
    ptr    += step;
    logical += 1;
  }
  if (logical !== index) return NIL;                 // out‑of‑bounds
  if (ptr.read().isCompound()) return NIL;           // refuse overwrite
  ptr.write(newValue);                               // in‑place update
  return newValue;
}
```

### Transform (`mapTuple`, TypeScript‑like)

```ts
function mapTuple(srcHeader: CellPtr, fn: (v: Value) => Value): CellPtr {
  const buffer: Value[] = [];
  iterate(srcHeader, (v) => buffer.push(fn(v)));
  return buildRList(buffer); // performs final reversal + header
}
```

(`setAt`, Pseudocode)

```pseudocode
function setAt(tuple, index, newValue):
    header    = SP           # assumes tuple is at SP
    cellCount = header.slot
    ptr       = header + 1
    logicalIx = 0
    while logicalIx < index and ptr < header + 1 + cellCount:
        step = (isCompound(*ptr) ? (*ptr).slot + 1 : 1)
        ptr       += step
        logicalIx += 1
    if logicalIx != index:
        return NIL           # out‑of‑bounds
    if isCompound(*ptr):
        return NIL           # refuse to overwrite compound value
    *ptr = newValue          # in‑place update
```

### Transform (map), Pseudocode

```pseudocode
function mapTuple(tuple, fn):
    builder = []          # temp list of cells
    iterate(tuple, (v) => builder.append(fn(v)))
    return buildRList(builder)  # performs final reversal + header
```

(`set-at`)

1. Traverse as in `each-r` until logical index reached.
2. Overwrite cell (verify simple value).

### Transform (map)

1. Allocate new tuple builder on temp stack.
2. Traverse old tuple; push transformed values.
3. Close new `]` word → produces rebuilt tuple.

---

## Composition Patterns

### Homogeneous Tuples

```tacit
[ 10 20 30 40 ]        # numeric array
```

Efficient pointer math; suitable for bulk numeric loops.

### Heterogeneous Tuples

```tacit
[ "name" 42 `active ]  # mixed types
```

No penalty beyond per‑element tag checks.

### Nested Tuples / Trees

```tacit
[ `root [ `left ] [ `right [ `leaf ] ] ]
```

RLIST naturally nests; each subtree is one contiguous block.

---

## Construction Strategies

### Programmatic Builder (TypeScript‑like)

```ts
const buf: Value[] = [];
buf.unshift(10);   // prepend O(1)
buf.unshift(20);
buf.unshift(30);
// buf now holds [30, 20, 10] in logical order
const rtuple: CellPtr = buildRList(buf);  // reverse + header
```

### Concatenation (`concatR`, TypeScript‑like)

```ts
function concatR(t1: CellPtr, t2: CellPtr): CellPtr {
  const out: Value[] = [];
  out.push(...copyReverse(t1.payload));
  out.push(...copyReverse(t2.payload));
  return buildRList(out);
}
```

(concat‑r, Pseudocode)

```pseudocode
function concatR(t1, t2):
    builder = []
    builder.copyReverse(t1.payload)  # copy in forward logical order
    builder.copyReverse(t2.payload)
    return buildRList(builder)       # close into a new RLIST
```

(concat‑r)

1. Allocate new builder.
2. Copy payload of first tuple (reverse‑copy into builder temp).
3. Copy payload of second tuple.
4. Close `]` to emit combined tuple.

Cost O(n₁ + n₂) but only one final reversal.

---

## Performance Characteristics

| Pattern | Head (O) | Tail (O) | Random access | Sequential scan | Memory Overhead |
| ------- | -------- | -------- | ------------- | --------------- | --------------- |
| RLIST   | 1        | *s*      | *s* worst     | *s*             | +0 cells        |
| LIST    | *n*      | 1        | *n*           | *n*             | +1 LINK         |

`n` = element count, `s` = slot count.  For simple homogeneous data `n == s`.

---

## Buffer Interoperability Details

### Export (`rlistToBuffer`)

```ts
function rlistToBuffer(header: CellPtr, buf: CellPtr): void {
  const s = header.slot;
  buf[0] = header.read();  // copy header
  for (let i = 0; i < s; i++) {
    buf[1 + i] = (header + 1 + (s - 1 - i)).read(); // reverse copy
  }
}
```

### Import (`bufferToRlist`)

```ts
function bufferToRlist(buf: CellPtr): CellPtr {
  const s = buf[0].slot;
  const temp: Value[] = [];
  for (let i = 0; i < s; i++) temp.push(buf[1 + i]);
  return buildRList(temp); // handles reversal + header
}
```

(`buf>rlist`)

1. Read `s = buf[0].slot`.
2. Copy `buf[1…s]` onto stack in forward order.
3. Reverse entire `s` cells.
4. Push header `RLIST:s`.

Both are O(s) and avoid per‑cell branching inside the copy loop.

---

## Comprehensive Error‑Handling Rules

| Condition                  | Result           | Notes                       |
| -------------------------- | ---------------- | --------------------------- |
| Index out of bounds        | `NIL`            | no exception model on stack |
| Wrong type (expect simple) | `NIL`            | muted failure               |
| Mutation on compound cell  | Ignored or `NIL` | implementation option       |

---

## Implementation Checklist (Detailed)

1. **Tag Table** – allocate opcode for `RLIST`.
2. **Parser Words** – `[`, `]`, `reverse-span` helper.
3. **Library Primitives** – `.slot`, `.skip`, `.prepend`, `.append`, `.get`, `.set`.
4. **Optimiser** – detect homogeneous simple tuples and constant‑fold index arithmetic.
5. **Documentation** – update maplists & capsules to reference RLIST compatibility.
6. **Test Suite** – property‑based generator ensuring round‑trip equivalence to forward LIST.

---

## Related Specifications

* `docs/specs/lists.md` – forward lists
* `docs/specs/tagged-values.md` – NaN‑boxing tag system
* `docs/specs/maplists.md` – associative maps
* `docs/specs/capsules.md` – object model on lists
* `docs/specs/stack-operations.md` – stack manipulation primitives

---

*End of TACIT Reverse Lists Specification*
