# Implementation Status: Implemented
- Core sequence abstraction: **Implemented** in `src/seq/`
- Basic iteration methods: **Implemented** §1-3
- Advanced composition: **Partially Implemented** §4-5
- Related to [polymphism.md] for polymorphic sequence handling

# Tacit Language: Advanced Sequence Processing – Expanded Version

This expanded document builds on the core ideas of Tacit’s sequence model, providing **detailed explanations and worked examples** for each concept. It serves both as a language guide and as an architectural reference.

---

## 1. Net Arity and Stack-Based Processing

### Concept

In Tacit, **net arity** describes how a function transforms the stack. It is the difference between the number of values **consumed** from the stack and the number of values **produced**.

For example:
- A function with arity `(2 → 1)` has net arity -1  
- A function with arity `(1 → 1)` has net arity 0  
- A function with arity `(1 → 2)` has net arity +1  

For sequence processing, **net arity zero is preferred** because it guarantees that each step keeps the stack balanced, which is especially important in forward-only, pipeline-style processing.

### Example

Suppose we define a function as the following deferred code block:

```
(dup +)
```

Applied to the value `5`:

```
5 (dup +) each
```

Results in:

```
5 → dup → 5 5 → + → 10
```

This function has net arity 0 and is safe for use in `each`.

---

## 2. Unification of Map, Scan, and Mask

### Concept

Tacit unifies several common sequence-processing operations using a single abstraction: `each`.

- **Map**: Apply a function to each element, emitting one result per input.  
- **Scan**: Carry an accumulator on the stack that updates at each step.  
- **Mask**: Apply a predicate function to produce a sequence of booleans, used later for filtering.

These variations differ only in how the function behaves—they all operate under the same structural mechanism of `each`.

### Example: Mapping with `each`

```
[1 2 3] (2 *) each
→ [2 4 6]
```

Here, the function `(2 *)` multiplies each item by 2.

### Example: Scanning with `each`

Using the function `(+)` and an initial accumulator:

```
0 [1 2 3] (+) each
→ [1 3 6]
```

Here, the accumulator is combined with each element in turn.

### Example: Creating a Mask

We can generate a mask by applying a predicate function:

```
[10 15 20] (10 >) each
→ [0 1 1]
```

This is not a filter—it’s a **mask**, which will be used later by a separate `filter` operation.

---

## 3. Filter as a Separate, Shape-Reducing Process

### Concept

While `each` is length-preserving, **`filter` is not**. It takes two input sequences:

- A data sequence  
- A mask sequence (of booleans)  

And produces a new sequence containing only the elements for which the mask is true.

This is the canonical example of a **shape-reducing sequence** in Tacit.

### Example

```
[10 20 30] [1 0 1] filter
→ [10 30]
```

`filter` walks both sequences in lockstep and emits values only where the mask is 1.

---

## 4. Arrays as Functions

### Concept

In Tacit, arrays can serve as **functions** that map indices to values. This allows them to be passed into `each` in place of deferred code blocks, acting as lookup tables.

### Example: Direct Use

```
0 [100 200 300] call
→ 100
```

### Example: Used with `each` as a lookup function

```
[2 0 1] [100 200 300] each
→ [300 100 200]
```

Here, the array `[100 200 300]` is used as a function, and the input sequence `[2 0 1]` provides the indices to look up.

This idiom is extremely useful and expressive: the array is a first-class functional object.

---

## 5. Range Sequences and Function Application

### Concept

Tacit treats ranges as native sequence sources. While it's common to apply a function to a range (e.g., to simulate array generation), this is **just a use of `each` over a range**, not a separate abstraction.

### Example

```
(2 *) 0 1 2 3 range each
→ [0 2 4 6]
```

This applies the doubling function to the range `[0 1 2 3]`.

There is no special “function sequence” type—just sequences and functions.

---

## 6. Paginated Sequences

### Concept

A **paginated sequence** allows Tacit to process large or remote data sources efficiently by fetching data incrementally. Rather than materializing all data upfront, a sequence is backed by:

- A **fetch function** `(offset size -- status cursor [chunk])`
- A **buffer size**

Each call to `next` retrieves a page of data using the function and continues until the data source is exhausted.

### Example

```rpn
(fetch-page) 100 paged
```

This creates a paginated sequence using `(fetch-page)` with a buffer size of 100. The fetch function will be called repeatedly with the current offset and buffer size to retrieve data chunks.

---

## 7. Polymorphism via Tagged Sequence Types

### Concept

Sequences in Tacit are implemented as tagged values. Each sequence has a **type tag** that defines how it should behave when passed to `next`.

Common sequence tags include:

- `SEQ_SRC_VECTOR` – Realized array or view
- `SEQ_SRC_RANGE` – Generated range
- `SEQ_SRC_PAGINATED` – Pull-based paginated fetch
- `SEQ_SRC_STRING` – Sequence of characters
- `SEQ_SRC_MULTI_SEQUENCE` – Composed or zipped sequence

The `next` operation is **polymorphic**: it checks the tag and calls the corresponding handler.

### Example

```rpn
[5 10 15] (2 *) each
```

The input is a vector sequence. `each` dispatches to the `SEQ_SRC_VECTOR` implementation of `next`, consuming and transforming each item.

---

## 8. Hot and Cold Sequences

### Concept

Tacit distinguishes between **cold** and **hot** sequences:

- **Cold sequences** (e.g. ranges, arrays) restart from the beginning when reused.
- **Hot sequences** (e.g. real-time streams) cannot be restarted and yield new values on each call.

### Example

```rpn
(0 1 2 3 range) dup
```

This produces two independent range sequences—each starts from zero. If instead you had a hot sequence like an event stream, duplication would continue from the current point.

---

## 9. Multi-Input Sequences and Combiners

### Concept

Some operations consume **multiple input sequences** and combine their values element-wise. These are modeled as processors that accept two or more sequences and apply a combining function.

Common combiners include:

- `zip` – Pairs values from two sequences
- `combine` – Applies a function to multiple inputs

### Example

```rpn
[1 2 3] [10 20 30] (add) zip each
→ [11 22 33]
```

This zips together the sequences and applies the `(add)` function to each pair.

---

## 10. Dictionaries as Functions

### Concept

Just like arrays map indices to values, **dictionaries map keys to values**. Tacit allows dictionaries to be used **as functions**, performing lookups when passed a key.

This allows dictionary-based mapping in sequences.

### Example

```rpn
[`a 1 `b 2 `c 3] as-dict
[`b `a `c] dict each
→ [2 1 3]
```

Here, the dictionary maps symbols to numbers, and a sequence of keys is used to retrieve values in order. The dictionary acts as a callable function.

This pattern is especially powerful for symbolic lookups or joining label-based datasets.

---

## 11. General Design Principles

- **Sequences are forward-only**, atomic, and composable.
- **each** is the central abstraction for processing any sequence.
- Sequences avoid materializing data until needed.
- All heap values are stored in fixed-size 64-byte blocks, which are reference counted and reused for efficient memory management.
- Functions, arrays, dictionaries, and even remote data sources can all be treated **uniformly** through sequence abstraction.

---

## 12. Summary of Unified Sequence Concept

| Concept        | Representation in Tacit                      |
|----------------|----------------------------------------------|
| Array          | Index → value                                |
| Dictionary     | Key → value                                  |
| Range          | Native sequence source                       |
| Mask           | Sequence of booleans from `each` predicate   |
| Filter         | Shape-reducing processor using a mask        |
| Paginated      | Sequence backed by fetch + buffer            |
| Multi-input    | Combiners like `zip` or `combine`            |
| each           | Central higher-order processor               |

---

## 13. Future Directions

### Static Analysis for Net Arity

Tacit may include compile-time analysis of code blocks and function sequences to verify **net arity correctness**. This ensures that each block preserves stack balance and avoids subtle runtime stack errors.

### Dynamic Assertions

Tacit supports dynamic runtime assertions using the `assert` word:

```rpn
(stack-depth 3 =) assert
```

If the predicate fails, an exception is thrown. This mechanism can be used to:

- Check stack consistency
- Debug sequence pipelines
- Validate input conditions

Together, static and dynamic tools offer robust support for safe, composable sequence programming.

---