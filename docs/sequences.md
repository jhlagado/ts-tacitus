# Simple Sequences in Tacit

Tacit uses sequences as the primary model of iteration. Instead of traditional `for` or `do` loops, programs compose sequences from source, transformer, and sink stages. These stages form declarative pipelines which are later compiled into efficient imperative code. This document defines the canonical forms of simple sequences, excluding branching, joining, or coroutine mechanisms.

## 1. Overview

A **sequence** in Tacit is a conceptual pipeline. Each stage in the pipeline serves one of three roles:

* **Source** – Supplies values to be processed.
* **Transformer** – Processes or filters those values.
* **Sink** – Consumes the results, either producing side effects or realizing them into memory.

Tacit syntax is postfix (RPN), and sequence pipelines are constructed by chaining stages left to right. Code blocks are used for per-item behavior but do not introduce new scope. Local variables may be assigned and reused within these blocks using the `->` arrow notation.

---

## 2. Sources

Sources define the start of a sequence pipeline. They produce values for downstream processing.

### 2.1 `range`

The simplest numeric source:

```
start end range
```

Emits integers starting from `start` up to (but not including) `end`. Always increments by one.

### 2.2 `range-by`

```
start end step range-by
```

Generalized range that allows positive or negative steps. Emits values starting at `start`, increasing (or decreasing) by `step`, and stopping before exceeding `end`.

### 2.3 Tuple and Memory Sources

Tacit supports sequence sources derived from memory-based structures:

* `from-tuple` – Emits each element of a tuple in order.
* `from-array` – Reads elements from a vector.
* `from-string` – Emits characters from a string.

These allow fixed or dynamic containers to participate in pipelines.

### 2.4 Contextual Source Inference (optional)

If a memory-based value (e.g. an array or tuple) is directly passed into a transformer, Tacit may infer and insert the appropriate `from-` source. This polymorphism is optional and contextual, but allows cleaner syntax in common cases.

---

## 3. Transformers

Transformers operate on each value from upstream, potentially modifying or filtering it. They are classified into two groups:

### 3.1 Linear Transformers

Linear transformers preserve the sequence length. Each input yields exactly one output.

#### `map`

```
map { ...block... }
```

Applies a block to each item. The block must have **net arity zero**: it consumes one value and emits one value. It may use local variables via `->` and does not create new scope.

##### Example: square each value

```
1 5 range
map { -> x x x * }
```

##### Example: cumulative sum via stack threading

```
0              ; initial accumulator
1 5 range      ; emits 1, 2, 3, 4
map { -> x x + x }
```

This uses the top stack value (`x`) and the second value (accumulator), adds them, and emits both for the next iteration.

### 3.2 Flow-Altering Transformers

These may suppress, skip, or discard inputs, altering the output flow. They require internal state.

#### `filter`

```
filter { ...predicate... }
```

Applies a Boolean predicate to each input. If it returns `1`, the item is passed through. If `0`, it is skipped. The block must have net arity zero and return a single Boolean value.

#### `take`

```
n take
```

Passes only the first `n` items, then halts output. Internally counts emissions.

#### `discard`

```
n discard
```

Skips the first `n` items, then passes all remaining ones. Internally counts skips.

---

## 4. Sinks

Sinks terminate a sequence by consuming all remaining values. Some are used for side effects; others convert the stream into concrete data.

### 4.1 `for-each`

```
for-each { ...block... }
```

Executes a block on each value. The block is run purely for side effects such as printing, logging, or output. It does not emit any value and is always terminal.

### 4.2 Realization Sinks

These create memory-based outputs:

* `to-array` – Collects values into a vector.
* `to-tuple` – Produces a fixed-length tuple.
* `to-string` – Concatenates characters into a string.

These functions clearly declare the desired output format and replace generic terms like `collect`.

---

## 5. Summary

Tacit sequences are declarative and compositional. They replace loops with clearly segmented stages that can be compiled efficiently. This document formalizes the core building blocks of simple pipelines:

* **Sources** – `range`, `range-by`, `from-tuple`, `from-array`, `from-string`
* **Linear transformers** – `map`
* **Flow-altering transformers** – `filter`, `take`, `discard`
* **Sinks** – `for-each`, `to-array`, `to-tuple`, `to-string`

All other sequencing features—branching, joining, coordination—build on these foundations and will be addressed separately.

