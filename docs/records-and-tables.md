- [Records and Tables](#records-and-tables)
  - [Preface](#preface)
  - [1 Buffers – Raw Memory as First-Class Value](#1-buffers-raw-memory-as-a-first-class-value)
    - [1.1 Definition](#11-definition)
    - [1.2 Lifetime & Promotion](#12-lifetime-promotion)
    - [1.3 Streams and Sinks](#13-streams-and-sinks)
  - [2 Do-Pointers – Making Buffers Executable](#2-do-pointers-making-buffers-executable)
  - [3 Numeric Views – Arrays](#3-numeric-views-arrays)
    - [3.1 Arity and Rank](#31-arity-and-rank)
    - [3.2 Shape Vectors](#32-shape-vectors)
    - [3.3 Reshape](#33-reshape)
    - [3.4 Slice](#34-slice)
    - [3.5 Bounds Policies](#35-bounds-policies)
  - [4 Symbolic Views – Records](#4-symbolic-views-records)
    - [4.1 Record Table Layout](#41-record-table-layout)
    - [4.2 Compile-Time Macro](#42-compile-time-macro)
    - [4.3 Dynamic Records](#43-dynamic-records)
    - [4.4 Nested Records and Sub-arrays](#44-nested-records-and-sub-arrays)
  - [5 Hybrid Views – Tables](#5-hybrid-views-tables)
    - [5.1 Row-Oriented (Array of Records)](#51-row-oriented-array-of-records)
    - [5.2 Column-Oriented (Record of Arrays)](#52-column-oriented-record-of-arrays)
    - [5.3 Unified Access Word](#53-unified-access-word)
    - [5.4 Schema Re-use](#54-schema-re-use)
  - [6 Inter-conversion & Composition](#6-inter-conversion-composition)
  - [7 Bounds & Policy Flags (Unified)](#7-bounds-policy-flags-unified)
  - [8 Performance Notes](#8-performance-notes)
  - [9 Conclusion](#9-conclusion)

### Records and Tables

## Preface

Tacit is built on a single idea: **memory is raw, interpretation is functional**.
A buffer is nothing but bytes; a _view_ is an ordinary Tacit word that turns
coordinates into offsets. Attach a view to a buffer and you have an _array_.
Swap in a view that accepts symbols instead of numbers and you have a _record_.
Compose numeric and symbolic views and you get _tables_.

Because every structure is just “buffer + view (+ do-pointer)”, the runtime stays
small, stack-friendly, and allocation-free unless you ask for more. The pages
that follow climb from unstructured bytes to multidimensional tensors, then to
symbol-indexed records and finally to mixed-axis tables—without adding new
runtime concepts at any step.

## 1 Buffers – Raw Memory as First-Class Value

### 1.1 Definition

A **buffer** is a contiguous block of elements, each of fixed width
(default = 4 bytes, perfect for NaN-boxed scalars and pointers).
Metadata stored just ahead of the payload:

| word    | meaning                                          |
| ------- | ------------------------------------------------ |
| `len`   | number of elements                               |
| `ew`    | element width (bytes)                            |
| `flags` | bit-field: do-pointer present, policy bits, etc. |
| `do*`   | _(optional)_ pointer to interpretation word      |

### 1.2 Lifetime & Promotion

Buffers are allocated in locals by default; they live until the frame returns.
To return a buffer, Tacit performs **copy-down promotion**: the buffer is
mem-copied into the caller’s local space and a pointer to it is pushed as the
return value—no heap, no leaks.

### 1.3 Streams and Sinks

A buffer can:

- stream its elements (`buffer source → sequence`)
- receive a stream (`sequence sink → buffer`)
- be converted back and forth with `to-array` / `from-array` words.

Because the same bytes may serve as payload or stream cache, materialisation is
always explicit.

## 2 Do-Pointers – Making Buffers Executable

A **do-pointer** is an optional function pointer in the buffer header.
If present, calling the buffer jumps to that word with:

```
( …indices  buffer -- …result )
```

- No extra closures: a single word can serve a million buffers.
- Removing the do-pointer returns the buffer to inert status.

Typical roles:

- Numeric view (array indexing)
- Symbolic view (record field lookup)
- Custom decoder (e.g., tagged union discriminator)

## 3 Numeric Views – Arrays

### 3.1 Arity and Rank

A numeric view of arity **N** defines an **N-rank array**.
Example 2-D view:

```
: row-major-2d ( i j  buf -- offset )
    buf shape@ 2 pick  ⟹ stride calc …
```

### 3.2 Shape Vectors

A **shape vector** is a buffer whose payload is `[d0 d1 … dn]`.
Installing the standard `shape→view` word makes it executable:

```
[3 4 5]  do* shape-view
```

It now answers both _offset_ and _metadata_ queries (`rank`, `size`, `axis-len`).

### 3.3 Reshape

`reshape ( shape  array -- array' )`
Verifies total size, swaps in new view: O(1) time, O(1) space.

### 3.4 Slice

`slice ( [start stop step]… array -- subarray )`
Wraps the old view with an offset/stride transformer; zero copy.

### 3.5 Bounds Policies

Per-array flags:

- `ERR` – trap on out-of-range
- `CLAMP` – clamp to nearest valid cell
- `MOD` – modulo wrap
- `RAW` – unchecked

## 4 Symbolic Views – Records

### 4.1 Record Table Layout

```
[ field-count
  sym₀  off₀  wid₀ tag₀
  sym₁  off₁  wid₁ tag₁
  … ]
```

- `symᵢ` is an interned symbol pointer.
- Installed do-pointer: `record-view ( sym  buf -- offset )`.

### 4.2 Compile-Time Macro

```
record: Person
    age    f32
    name   sym*
    scores [3]f32
;
```

Macro emits:

- Shared table buffer (above)
- `person-view` word
- `Person-size` constant
- Helper words `>age`, `>name`, `>scores`.

### 4.3 Dynamic Records

Allocate table at run time, store pointer in header, set `SELF` flag.
Same `record-view` dispatches after reading header pointer.

### 4.4 Nested Records and Sub-arrays

A field whose `tag = SUBVIEW` is treated as `pointer → buffer+view`.
Thus:

```
person 'scores get       ( -- subarray )
```

works without new syntax.

## 5 Hybrid Views – Tables

### 5.1 Row-Oriented (Array of Records)

```
row-view   ( row#  tbl -- rec-offset )
record-view ( sym row# tbl -- value )
```

Rows contiguous; good for inserts.

### 5.2 Column-Oriented (Record of Arrays)

```
schema-view ( sym tbl -- col-buf )
array-view  ( idx sym tbl -- value )
```

Columns contiguous; good for analytics.

### 5.3 Unified Access Word

```
get@ ( idx|sym ... tbl -- value )
```

_Detects orientation flag, composes appropriate views._

### 5.4 Schema Re-use

Single field table works for both layouts:

- Row store uses `off` as byte offset.
- Column store uses `off` as pointer to column buffer.

## 6 Inter-conversion & Composition

| Goal                            | Word sequence                                   |
| ------------------------------- | ----------------------------------------------- |
| Flatten record field of vectors | `tbl 'scores get flatten`                       |
| Slice top 100 rows              | `0 100 slice-rows`                              |
| Reshape numeric column          | `'scores get [10 3] reshape`                    |
| Switch orientation              | `tbl to-columnar` _(builds new composite view)_ |

All zero-copy because only views change.

## 7 Bounds & Policy Flags (Unified)

| Flag bit | Arrays (numeric) | Records (symbolic) |
| -------- | ---------------- | ------------------ |
| `ERR`    | trap             | trap missing field |
| `CLAMP`  | clamp index      | n/a                |
| `MOD`    | modulo index     | n/a                |
| `RAW`    | unchecked        | unchecked          |
| `MISS=0` | n/a              | return zero/void   |

The same four bits live in every buffer header; record-view ignores the ones
that don’t apply.

## 8 Performance Notes

- **Stride cache** keyed by shape pointer; reused by every array of that shape.
- **Record lookup**: ≤ 8 fields → linear scan; else binary search (O(log n)).
- **Zero-copy pipelines**: repeated slice/reshape/view chaining composes into a
  single offset function, JIT-inlinable.
- **Promotion cost**: mem-copy once, pointer push once, zero heap churn.

## 9 Conclusion

From raw buffers to multidimensional tensors, from symbol-indexed records to
mixed-axis tables, Tacit relies on _one_ runtime primitive: **attach a view to
a buffer and let that view decide how to map keys to bytes**. Numeric keys give
arrays, symbolic keys give records, composing both gives tables. Because views
are ordinary words and buffers live naturally on the stack, complex data
structures cost nothing more than the code you already write—no hidden
allocations, no special containers, no new lifetime rules.

Future refinements—stride fusion, static shape checks, schema reflection—will
extend performance and ergonomics, but they will do so inside this single,
predictable framework: **memory is raw, interpretation is functional, and the
programmer is in charge of when the two meet.**
