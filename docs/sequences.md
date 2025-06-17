# Sequences in Tacit

Tacit uses sequences as the primary model of iteration and control flow. Instead of traditional for/while loops, if/else branches, or try/catch blocks, programs compose sequences from source, transformer, and sink stages. These stages form declarative pipelines which are later compiled into efficient imperative code. This document defines the canonical forms of sequences and how they replace traditional control constructs.

## 1. Introduction

### 1.1 Why Sequences?

In traditional programming languages, control flow is managed through imperative constructs like loops (`for`, `while`), conditionals (`if-else`, `switch`), and exception handling (`try-catch`). Tacit takes a different approach by elevating sequences to the primary abstraction for control flow.

Instead of telling the computer *how* to iterate through data step-by-step, sequences express *what* transformations should occur. This declarative model eliminates the need for explicit looping constructs and state management:

| Traditional Construct | Tacit Sequence Equivalent |
|---------------------|-------------------------|
| Loops | `range`, `from-tuple`, etc. with transformers |
| Conditionals | `filter`, `split`, `if-else` |
| Exception handling | `retry`, `fallback` |

This paradigm shift offers several benefits:
- **Composability**: Sequence operations connect naturally in pipelines
- **Cleaner data flow**: Data moves predictably without shared mutable state
- **Pattern consistency**: Common operations follow the same shape across the language
- **Resource safety**: Sequence lifecycle ensures proper resource management

### 1.2 Core Sequence Concepts

A sequence in Tacit consists of three main components:

## Table of Contents
- [Sequences in Tacit](#sequences-in-tacit)
  - [1. Introduction](#1-introduction)
    - [1.1 Why Sequences?](#11-why-sequences)
    - [1.2 Core Sequence Concepts](#12-core-sequence-concepts)
  - [Table of Contents](#table-of-contents)
  - [1. Introduction](#1-introduction-1)
  - [2. Sources](#2-sources)
    - [2.1 Basic Sources](#21-basic-sources)
      - [2.1.1 `range`](#211-range)
    - [2.2 Memory-Based Sources](#22-memory-based-sources)
      - [2.2.1 `from-tuple`](#221-from-tuple)
      - [2.2.2 `from-array`](#222-from-array)
      - [2.2.3 `from-string`](#223-from-string)
    - [2.3 Dynamic Sources](#23-dynamic-sources)
      - [2.3.1 Implicit Source Inference](#231-implicit-source-inference)
    - [2.4 Fallback Sources (Providing Alternatives on Failure)](#24-fallback-sources-providing-alternatives-on-failure)
    - [2.5 Paginated Sources (Buffered Blockwise Input)](#25-paginated-sources-buffered-blockwise-input)
      - [2.4.2 Block Behavior](#242-block-behavior)
      - [2.5.1 Pagination Patterns](#251-pagination-patterns)
  - [3. Sentinels and Control Flow](#3-sentinels-and-control-flow)
    - [3.1 Sentinel Representation](#31-sentinel-representation)
      - [3.1.1 Literal Syntax for Sentinels](#311-literal-syntax-for-sentinels)
    - [3.2 Retry-Based Sources](#32-retry-based-sources)
      - [3.2.1 Retry Strategies](#321-retry-strategies)
    - [3.3 Fallback Sources](#33-fallback-sources)
    - [3.4 Sentinel Handling and Pattern Matching](#34-sentinel-handling-and-pattern-matching)
    - [3.5 Nil as Degenerate Tuple](#35-nil-as-degenerate-tuple)
  - [4. Transformers](#4-transformers)
    - [4.1 Linear Transformers (Map)](#41-linear-transformers-map)
      - [4.1.1 Basic Example: Squaring Numbers](#411-basic-example-squaring-numbers)
      - [4.1.2 Stateful Mapping (Scan)](#412-stateful-mapping-scan)
        - [Example: Cumulative Sum](#example-cumulative-sum)
    - [4.2 Flow-Altering Transformers](#42-flow-altering-transformers)
      - [4.2.1 Filter (`filter`)](#421-filter-filter)
      - [4.2.2 Take (`take`)](#422-take-take)
      - [4.2.3 Discard (`discard`)](#423-discard-discard)
    - [4.3 Flow-Combining Transformers](#43-flow-combining-transformers)
      - [4.3.1 Zip (`zip`)](#431-zip-zip)
      - [4.3.2 Additional Flow-Combiners](#432-additional-flow-combiners)
    - [4.4 Mapping as Functional Transformation](#44-mapping-as-functional-transformation)
      - [4.4.1 Scalar Transformations](#441-scalar-transformations)
      - [4.4.2 Using Arrays as Functions](#442-using-arrays-as-functions)
      - [4.4.3 Stateful Mapping (Scan)](#443-stateful-mapping-scan)
    - [4.5 Building Complex Behaviors Step-by-Step](#45-building-complex-behaviors-step-by-step)
  - [5. Sinks](#5-sinks)
    - [5.1 Side-Effect Sinks](#51-side-effect-sinks)
      - [5.1.1 `for-each`](#511-for-each)
    - [5.2 Realization Sinks](#52-realization-sinks)
      - [5.2.1 `to-array`](#521-to-array)
      - [5.2.2 `to-tuple`](#522-to-tuple)
      - [5.2.3 `to-string`](#523-to-string)
    - [5.3 Terminal-Value Sinks](#53-terminal-value-sinks)
      - [5.3.1 `last`](#531-last)
    - [5.4 Summary of Sink Behavior](#54-summary-of-sink-behavior)
  - [7. Lifecycle and Resource Management](#7-lifecycle-and-resource-management)
    - [7.0 Integrating Sequences with Other Tacit Features](#70-integrating-sequences-with-other-tacit-features)
      - [7.0.1 Sequences and Memory Management](#701-sequences-and-memory-management)
      - [7.0.2 Sequences and Coroutines](#702-sequences-and-coroutines)
    - [7.1 Source Lifecycle](#71-source-lifecycle)
    - [7.2 Restartable vs. Non-Restartable Sources](#72-restartable-vs-non-restartable-sources)
    - [7.3 Resource Ownership](#73-resource-ownership)
    - [7.4 Best Practices](#74-best-practices)
  - [6. Advanced Techniques](#6-advanced-techniques)
    - [6.1 Error Handling and Recovery Patterns](#61-error-handling-and-recovery-patterns)
      - [6.1.1 Retry Loops](#611-retry-loops)
      - [6.1.2 Fallback Sequences](#612-fallback-sequences)
    - [6.3 Polymorphism and Implicit Source Inference](#63-polymorphism-and-implicit-source-inference)
    - [6.2 Sequences as Functions (Nested Sequences)](#62-sequences-as-functions-nested-sequences)
      - [6.2.1 Example: Factorial Sequence](#621-example-factorial-sequence)
    - [5.2 Realization Sinks](#52-realization-sinks-1)
      - [5.2.1 `to-array`](#521-to-array-1)
      - [5.2.2 `to-tuple`](#522-to-tuple-1)
      - [5.2.3 `to-string`](#523-to-string-1)
    - [5.3 Terminal-Value Sinks](#53-terminal-value-sinks-1)
      - [5.3.1 `last`](#531-last-1)
  - [6. Advanced Techniques](#6-advanced-techniques-1)
    - [6.1 Stateful Mapping and Scanning](#61-stateful-mapping-and-scanning)
      - [6.1.1 Simple Accumulation](#611-simple-accumulation)
      - [6.1.2 Sliding Window](#612-sliding-window)
    - [6.2 Error Handling and Recovery Patterns](#62-error-handling-and-recovery-patterns)
      - [6.2.1 Retry with Exponential Backoff](#621-retry-with-exponential-backoff)
      - [6.2.2 Fallback to Default Value](#622-fallback-to-default-value)
      - [6.2.3 Retry and Fallback Idioms](#623-retry-and-fallback-idioms)
    - [6.3 Polymorphism and Implicit Sources](#63-polymorphism-and-implicit-sources)
  - [7. Lifecycle and Resource Management](#7-lifecycle-and-resource-management-1)
    - [7.2 Restartable vs. Non-Restartable Sources](#72-restartable-vs-non-restartable-sources-1)
    - [7.3 Resource Ownership](#73-resource-ownership-1)
    - [7.4 Best Practices](#74-best-practices-1)
    - [7.5 Summary](#75-summary)
  - [8. Thinking in Sequences: A Translation Guide](#8-thinking-in-sequences-a-translation-guide)
    - [8.1 Loop to Sequence Translation](#81-loop-to-sequence-translation)
    - [8.2 Conditional Branching to Sequence Operations](#82-conditional-branching-to-sequence-operations)
    - [8.3 Exception Handling to Fallback Patterns](#83-exception-handling-to-fallback-patterns)
    - [8.4 Common Sequence Patterns](#84-common-sequence-patterns)

## 1. Introduction

In Tacit, all sequence pipelines begin with a source and end with a sink, with optional transformers in between. The sequence model represents a declarative approach to iteration and data transformation that is later compiled into efficient imperative code. Unlike traditional loops, Tacit sequences are stateless, composable, and support robust error handling through sentinel values.

Every sequence in Tacit returns a *sequence object*—a self-contained generator with a `next` method and optional `restart`. This object can be passed downstream into transformer stages like `map` or `filter`, and ultimately into a sink like `for-each` or `to-array`.

Sequences are strictly typed and arity-bound. They take a fixed number of arguments, either scalar or tuple, and emit one item per call to `next`. Where multiple inputs are needed—such as a start, end, and step value for a range—they are provided as a tuple.

## 2. Sources

A **source** stage is the entry point of a Tacit sequence. It defines a pull-based generator that emits one value per tick. Sources are either finite and deterministic (like ranges or tuples) or dynamic and potentially infinite (like stream readers or event sources).

### 2.1 Basic Sources

#### 2.1.1 `range`

```
n range
(t1 t2) range
(t1 t2 t3) range
```

Generates a sequence of integers from a starting point to an exclusive end point. The single-argument form emits numbers from zero up to (but not including) `n`. The two-element tuple specifies `[start end]`, and the three-element tuple specifies `[start end step]`.

All forms share the same implementation and are selected based on the arity of the tuple. Step may be positive or negative; iteration halts before crossing the end.

Examples:

```
10 range               → yields 0 1 2 3 4 5 6 7 8 9
(3 7) range            → yields 3 4 5 6
(10 0 -3) range        → yields 10 7 4 1
```

### 2.2 Memory-Based Sources

Tacit allows containers to be lifted into sequences using `from-` words that convert memory structures into sequences:

#### 2.2.1 `from-tuple`

The `from-tuple` word lifts a tuple into a sequence. The sequence emits each element in order from first to last. The input must be a valid tuple tagged value.

```
(tuple) from-tuple
```

Example:

```
(1 2 3) from-tuple     → yields 1 2 3
```

#### 2.2.2 `from-array`

The `from-array` word turns a Tacit array (flat vector) into a sequence source. Each index of the array is read and emitted in order.

```
array from-array
```

This behaves like `from-tuple`, but the backing structure is mutable (for vectors) and possibly larger.

#### 2.2.3 `from-string`

The `from-string` word produces a sequence of characters (bytes) from a UTF-8 string. The string is treated as an immutable byte vector.

```
"hello" from-string    → yields 'h' 'e' 'l' 'l' 'o'
```

Each emitted value is a character byte (not a full Unicode code point). Downstream stages may reassemble or interpret multi-byte values as needed.

### 2.3 Dynamic Sources

Dynamic sources are used for potentially infinite sequences or sequences that read from external resources like files, networks, or system inputs. Unlike deterministic sources, dynamic sources may produce different values on each run or may depend on external state.

#### 2.3.1 Implicit Source Inference

If a memory value is passed directly to a transformer, Tacit may implicitly lift it into a sequence using the appropriate `from-` stage. This behavior is optional and may be suppressed or customized. It improves ergonomics in common idioms like:

```
[1 2 3 4] map { ... }
```

This concise polymorphism is designed to be transparent, predictable, and unobtrusive, enhancing ease of use without compromising the explicitness central to Tacit's philosophy.

### 2.4 Fallback Sources (Providing Alternatives on Failure)

Fallback sources represent a composite stream that attempts a primary sequence and, upon receiving a designated sentinel, switches to a secondary sequence. This construct enables robust handling of transient or recoverable errors by offering an alternative data source when failures occur.

```
(<sentinels>) (<strategy>) fallback { primary-sequence } { fallback-sequence }
```

This form uses **two tuples** followed by **two code blocks**:

* The **first tuple** is a list of sentinel values that should trigger a fallback.
* The **second tuple** is an optional strategy configuration.
* The **two code blocks** define complete restartable sequences: the first is the primary source, and the second is the fallback.

If the primary sequence emits a sentinel that matches any in the first tuple, the fallback sequence is restarted from the beginning. This allows recovery pipelines to operate cleanly without explicit branching or error trapping.

### 2.5 Paginated Sources (Buffered Blockwise Input)

Paginated sources represent a sequence model designed to interface with chunked or blockwise input systems. These are commonly found in I/O contexts such as file reading, HTTP range requests, and streaming data from paginated APIs. The paginated source yields repeated views over a shared buffer, indicating how much data is valid on each tick.

The syntax for defining a paginated source follows this structure:

```
<buffer> paginate { ...block... }
```

Here, `buffer` is a preallocated, reusable memory arena passed by the user. The block has the signature:

```
buffer → count
```

#### 2.4.2 Block Behavior

On each tick, the code block is invoked with the buffer. It writes into the buffer and returns two values: the same buffer (by reference) and an integer representing the number of valid bytes written. 

If the count returned is zero, the sequence emits a sentinel such as `$done`, indicating termination.

Typical implementations may use system calls, file reads, or in-memory paging to fill the buffer. The reuse of a single buffer across ticks avoids allocation overhead and supports zero-copy semantics when appropriate.

#### 2.5.1 Pagination Patterns

Pagination is essential when working with large datasets from APIs or databases. Tacit provides clean abstractions for different pagination approaches:

1. **Offset-based pagination**: Uses page numbers or skip/limit
   ```
   buffer api-endpoint paginate-by-offset fetch-items
   ```

2. **Cursor-based pagination**: Uses a next-page token
   ```
   buffer api-endpoint paginate-by-cursor fetch-with-token
   ```

3. **Timestamp-based pagination**: Uses time boundaries
   ```
   buffer start-time paginate-by-time fetch-events
   ```

Each pattern follows Tacit's idiomatic one-line style while handling the complexity of chunked data retrieval.

## 3. Sentinels and Control Flow

### 3.1 Sentinel Representation

Sentinels in Tacit are special tagged values used within sequences to represent non-data control signals. Unlike ordinary data values, sentinels communicate status, errors, or termination conditions.

A sentinel is represented internally as a tagged value. It carries a dedicated tag (`sentinel`) and encodes both a sentinel type and additional metadata. Tacit reserves the most significant four bits of the sentinel payload to represent its type, providing up to sixteen distinct sentinel types.

Common sentinel types include:

* `$nil` (`0`): Temporary absence of data; downstream may retry.
* `$end` (`1`): Definitive end of stream; no further data will be produced.
* `$done` (`2`): Explicit early termination without error.
* `$retry` (`3`): Indicates a condition warranting a retry.
* `$wait` (`4`): Temporary pause; downstream should wait briefly and retry.
* `$error` (`5`): An unrecoverable error occurred.

#### 3.1.1 Literal Syntax for Sentinels

Tacit provides a concise literal syntax for sentinels using the `$` sigil:

```
$done
$error
$nil
```

This syntax provides readable sentinel values directly within Tacit code.

### 3.2 Retry-Based Sources

The `retry` source stage enables construction of robust, restartable sequences that can recover from sentinel values. Its primary purpose is to wrap a source sequence that may intermittently fail, retrying it when specific sentinel conditions occur.

```
(sentinels strategy) retry { ...block... }
```

Accepts a sentinel tuple and an optional strategy tuple, followed by a source-style block that produces a restartable sequence. If the block yields a sentinel value, the strategy determines whether and how to retry.

#### 3.2.1 Retry Strategies

The second argument specifies the retry strategy. Common strategies include:

* `%fixed n` — Retry up to `n` times.
* `%timeout t` — Retry until `t` milliseconds have elapsed.
* `%backoff base max` — Retry with exponential backoff starting from `base` ms and capped at `max` ms.

A `retry` block must contain a complete sequence. Typically, the final sink is a realization or capture stage such as `last` or `to-tuple`, so the entire retry unit can act as a function.

### 3.3 Fallback Sources

A `fallback` source defines a composite stream that attempts a primary sequence and, upon receiving a designated sentinel, switches to a secondary sequence. This construct enables robust handling of transient or recoverable errors by offering an alternative data source when failures occur.

```
(<sentinels>) (<strategy>) fallback { primary-sequence } { fallback-sequence }
```

This form uses **two tuples** followed by **two code blocks**:

* The **first tuple** is a list of sentinel values that should trigger a fallback.
* The **second tuple** is an optional strategy configuration.
* The **two code blocks** define complete restartable sequences: the first is the primary source, and the second is the fallback.

If the primary sequence emits a sentinel that matches any in the first tuple, the fallback sequence is restarted from the beginning. This allows recovery pipelines to operate cleanly without explicit branching or error trapping.

### 3.4 Sentinel Handling and Pattern Matching

Sequences such as `retry` and `fallback` explicitly match against sentinel values to determine control flow. Typically, sentinels used for matching are passed as tuples:

```
($error $wait) (strategy) retry { source-block }
```

Here, `retry` triggers only if the source emits `$error` or `$wait`. If other sentinel values (such as `$done`) appear, they're passed downstream untouched.

### 3.5 Nil as Degenerate Tuple

Tacit treats `nil` as a degenerate tuple, allowing it to be used in contexts expecting tuples. The degenerate tuple `()` (empty parentheses) represents `nil`. This convention is used when a placeholder or default argument is required.

```
($error) () retry { source-block }
```

Here, `()` indicates no specific retry strategy is required. Tacit treats an empty tuple as semantically equivalent to `nil`, and this practice extends throughout the language for optional arguments and polymorphic inputs.

## 4. Transformers

A **transformer** stage takes an input sequence and produces an output sequence. Transformers are the intermediate stages in a sequence pipeline, accepting upstream values, processing them, and emitting new values downstream. They can filter, map, combine, or otherwise manipulate the flow of data.

### 4.1 Linear Transformers (Map)

The `map` stage is a general-purpose transformer that applies a block to each item in a sequence. The block consumes an input value and produces an output value.

```
map { ...block... }
```

#### 4.1.1 Basic Example: Squaring Numbers

```
5 range
map { -> x x x * }
```

This sequence emits: `0 1 4 9 16`.

#### 4.1.2 Stateful Mapping (Scan)

Scan-like behavior is implemented by keeping an accumulator on the stack. The mapping block updates and re-emits it each time.

##### Example: Cumulative Sum

```
0 (1 2 3 4) from-tuple map { -> x x + x }
```

This sequence emits: `1 3 6 10`.

### 4.2 Flow-Altering Transformers

Flow-altering transformers selectively pass or block values from the input sequence, changing which items reach downstream stages.

#### 4.2.1 Filter (`filter`)

```
filter { ...predicate-block... }
```

Example:

```
(1 10) range filter { -> x x 2 mod 0 = }
```

This sequence emits: `2 4 6 8`.

#### 4.2.2 Take (`take`)

The `take` transformer limits the sequence to at most `n` items from the source.

```
n take
```

Example:

```
100 range 5 take
```

This sequence emits: `0 1 2 3 4`.

#### 4.2.3 Discard (`discard`)

The `discard` transformer skips the first `n` values in the sequence.

```
n discard
```

Example:

```
5 range 2 discard
```

This sequence emits: `2 3 4`.

### 4.3 Flow-Combining Transformers

These transformers combine two or more sequences into a single, unified output sequence. The primary flow-combining transformer is `zip`.

#### 4.3.1 Zip (`zip`)

Combines multiple sequences, emitting tuples with one value from each sequence per tick. It terminates when the shortest input sequence is exhausted.

```
(1 2 3) from-tuple (10 20 30) from-tuple zip
```

Output:

```
(1 10) (2 20) (3 30)
```

#### 4.3.2 Additional Flow-Combiners

Other flow-combiners, such as `merge` (interleaving sequences), could also be defined. For example, `merge` might alternate between sources or select based on availability:

```
source-a source-b merge
```

### 4.4 Mapping as Functional Transformation

Mapping operations in Tacit represent pure functional transformations from input values to output values. This section explores advanced mapping techniques and patterns.

#### 4.4.1 Scalar Transformations

The simplest map operations transform a scalar input into a scalar output:

```
map { -> x x x * }
```

This applies the same function to each element in the sequence independently.

#### 4.4.2 Using Arrays as Functions

Arrays can be used as lookup tables within mapping functions:

```
[10 20 30 40 50] -> values values (0 5) range map { -> i get }
```

This emits `10 20 30 40 50`.

#### 4.4.3 Stateful Mapping (Scan)

Mapping can also maintain state between iterations using techniques like scan:

```
0 (1 5) range map { -> x x + x }
```

This sequence yields `1 3 6 10`, representing the running sum at each point.

### 4.5 Building Complex Behaviors Step-by-Step

Sequences shine when building complex logic through simple composition. Tacit enables building solutions incrementally:

1. **Start with a data source**:
   ```
   (1 100) range
   ```

2. **Add filters and transformations**:
```
: divisible-by-3? { 3 mod 0 = }
: divisible-by-5? { 5 mod 0 = }
: divisible-by-3-or-5? { -> n n divisible-by-3? n divisible-by-5? or }
: square { -> n n n * }
: sum { + }

(1 100) range filter { divisible-by-3-or-5? } map { square } fold { sum }
```

This incremental composition approach replaces nested control structures with flat, linear data flow - each operation building on the previous one in a clean pipeline.

## 5. Sinks

Sinks are the final stages of sequences. They can be used to produce side effects or convert the sequence into a concrete data structure.

### 5.1 Side-Effect Sinks

#### 5.1.1 `for-each`

The `for-each` sink applies a block to each element in the sequence without returning a value.

```
sequence for-each { -> x ... }
```

Example:

```
5 range for-each { print }
```

This prints each number from `1` to `4`.

### 5.2 Realization Sinks

Realization sinks convert sequences into concrete data structures.

#### 5.2.1 `to-array`

The `to-array` sink accumulates items into a Tacit array (vector).

```
sequence to-array
```

Example:

```
(1 4) range to-array
```

This produces: `[1 2 3]`.

#### 5.2.2 `to-tuple`

The `to-tuple` sink converts the full stream into a fixed-length tuple.

```
sequence to-tuple
```

Example:

```
(1 4) range to-tuple
```

This produces: `(1 2 3)`.

#### 5.2.3 `to-string`

The `to-string` sink assembles character values from a sequence into a string.

```
sequence to-string
```

Example:

```
"hello" from-string map { -> c c upper } to-string
```

This produces: `"HELLO"`.

### 5.3 Terminal-Value Sinks

#### 5.3.1 `last`

The `last` sink returns only the last value emitted by the sequence.

```
sequence last
```

Example:

```
(1 5) range map { -> x x x * } last
```

This produces: `16`.

### 5.4 Summary of Sink Behavior

All sinks terminate the sequence pipeline. After a sink, no further Tacit stages can be chained, since the output is no longer a sequence. Instead, sinks return concrete values or produce external side effects.

The choice of sink clearly communicates the intended use of the data produced by the pipeline:

* For-each side effects (`for-each`): print, log, or draw each element
* Array realizers (`to-array`): store as an array/vector/list
* Tuple realizers (`to-tuple`): realize as a fixed-size tuple
* String realizers (`to-string`): convert char sequences into a string
* Terminal sinks (`last`, `fold`): extract the single most important value

## 7. Lifecycle and Resource Management

Sequence stages follow a well-defined lifecycle with clear ownership semantics for resources.

### 7.0 Integrating Sequences with Other Tacit Features

#### 7.0.1 Sequences and Memory Management

Sequences interact cleanly with Tacit's arena-based memory model:

```
buffer -> results source-data filter { valid? } map { transform } for-each { -> item results item append } results
```

Unlike systems with manual memory management or garbage collection:

1. The buffer is allocated in the current arena
2. Sequence operations produce transient data consumed by stages
3. The final buffer survives to be returned
4. No explicit cleanup/free is needed
5. No GC pressure accumulates during processing

#### 7.0.2 Sequences and Coroutines

Sequences work hand-in-hand with coroutines to handle asynchronous data:

```
event-source -> events events filter { -> e e "priority" get-field 3 >= } map { process-event } event-sink
```

The sequence acts as a declarative pipeline connecting producer and consumer coroutines, replacing traditional callbacks and promises.

### 7.1 Source Lifecycle

All sources progress through the following lifecycle phases:

| Phase        | Description                                                                        | Stack Behaviour |
| ------------ | ---------------------------------------------------------------------------------- | --------------- |
| **Init**     | Source is instantiated; internal counters/handles are set to their starting state. | no values       |
| **Yield**    | Each pull produces one value **or** a sentinel.                                    | pushes value    |
| **Complete** | Source emits `$end` (or `$done`) and releases any transient resources.             | pushes sentinel |
| **Restart**  | If wrapped by `retry`, source is re-instantiated—**Init** runs again.              | resets state    |

A source completion is signaled by producing a sentinel value such as `$end` or `$done`. Error conditions produce `$error` sentinels which may trigger retry behavior if the source is wrapped in `retry`.

### 7.2 Restartable vs. Non-Restartable Sources

| Source Type           | Restartable? | Notes                                                           |
| --------------------- | ------------ | --------------------------------------------------------------- |
| `range`, `from-tuple` | ✔︎           | Pure, deterministic; replays consistently.                      |
| `from-file`, network  | △            | May be restartable if connection can be re-established.         |
| `random`              | ✗            | Non-deterministic; each run produces different values.          |
| `from-db-cursor`      | ✗            | Stateful; cursor position cannot be rewound without side effect |

Restartable sources can be wrapped in retry loops that handle transient errors by re-executing from the beginning. Non-restartable sources should provide explicit alternatives through fallback sequences instead.

### 7.3 Resource Ownership

Tacit sequence stages follow clear rules for resource ownership:

1. Each source **owns** its own internal resources (file handles, network connections, etc.)
2. Resources are released when a source produces a sentinel value (`$end`, `$done`, `$error`)
3. The `retry` wrapper creates a new instance of the source when restarting, ensuring clean resource handling
4. External resources shared between stages (such as buffers) should be managed with explicit lifecycle indicators

### 7.4 Best Practices

* Use `fallback` for non-restartable sources instead of `retry`
* Always handle potential sentinel values in transformers
* Release external resources even if a sequence is interrupted
* Use `paginate` for sources that require incremental fetching or rate-limited APIs
* Consider using watchdog timers for sources that may not terminate

## 6. Advanced Techniques

### 6.1 Error Handling and Recovery Patterns

Tacit sequences use sentinel values to handle errors. Sentinel-aware constructs such as `retry` and `fallback` provide simple but powerful recovery mechanisms.

#### 6.1.1 Retry Loops

Retry loops can be used to handle intermittent errors.

```
($error) (%backoff 3 500) retry { buffer paginate { -> buf buf fill-api-data buf yield-values buf clear } }
```

#### 6.1.2 Fallback Sequences

Fallback sequences can be used to provide alternative sources when a primary fails or terminates early.

```
fallback { primary-source } { secondary-source }
```

### 6.3 Polymorphism and Implicit Source Inference

Tacit simplifies common pipeline patterns through selective polymorphism. In contexts like `map` or `filter`, where a sequence is expected, Tacit can implicitly insert a suitable `from-` source stage based on the input type.

```
[1 2 3] map { -> x x x * }
```

is implicitly interpreted as:

```
[1 2 3] from-array map { -> x x x * }
```

### 6.2 Sequences as Functions (Nested Sequences)

Nested sequences can appear within a map block as a function. Such nested sequences must be fully self-contained and terminated with a sink that produces a single scalar value, typically `last`.

#### 6.2.1 Example: Factorial Sequence

```
: fact { -> n (1 n) range 1 swap map { -> acc x acc x * } last }

5 range map { fact }
```

Using this structure, each value in the input sequence is fed into a self-contained `fact` sequence, which accumulates the product and returns just the final value via `last`.



### 5.2 Realization Sinks

Realization sinks convert sequences into concrete data structures. They consume all items in the sequence and produce a single, well-defined result.

#### 5.2.1 `to-array`

```
to-array
```

Collects all items from a sequence into a dynamic array (vector). This is useful when you need to store the result for later processing or when converting between sequence-based and memory-based operations.

#### 5.2.2 `to-tuple`

```
to-tuple
```

Converts the full stream into a fixed-length tuple. Unlike `to-array`, this creates an immutable tuple that contains all the items from the sequence.

#### 5.2.3 `to-string`

```
to-string
```

Assembles character values from a sequence into a string. This is commonly used after processing string data as a sequence.

### 5.3 Terminal-Value Sinks

#### 5.3.1 `last`

```
last
```

Returns the final item produced by a sequence, discarding all previous items. This is often used after a fold or accumulation operation, or when only the terminal result of a sequence is relevant.

## 6. Advanced Techniques

### 6.1 Stateful Mapping and Scanning

One of the most powerful features of Tacit sequences is the ability to perform stateful transformations. By maintaining state on the stack between iterations, sequences can implement complex algorithms like running totals, filtering with history, or state machines.

#### 6.1.1 Simple Accumulation

```
0 (1 2 3 4) from-tuple map { -> x x + x }
```

This produces a running sum: `1 3 6 10`

#### 6.1.2 Sliding Window

```
nil nil              \ Initial window (previous, current)
(1 2 3 4 5) from-tuple
map { -> p c x       \ Window state (p=prev, c=curr) and new value
     c p + x c      \ Compute sum and update window (new prev=c, new curr=x)
   }
```

This produces sums of adjacent pairs: `3 5 7 9`

### 6.2 Error Handling and Recovery Patterns

Tacit uses sentinel values rather than exceptions for error handling. This leads to several idiomatic patterns for handling errors in sequences.

#### 6.2.1 Retry with Exponential Backoff

```
($error) (%backoff 100 5000) retry { source-that-might-fail map { process-data } to-tuple }
```

This retries a failing source with exponential backoff starting at 100ms and capping at 5000ms.

#### 6.2.2 Fallback to Default Value

```
($error) () fallback { primary-source } { (default-value) from-tuple }
```

If the primary source fails, this fallback structure will emit a default value instead.

#### 6.2.3 Retry and Fallback Idioms

Tacit provides concise idioms for robust error handling and resilience patterns:

1. **Simple retry for network operations**:
   ```
   ($network-error) (3) retry { api-endpoint fetch-data }
   ```

2. **Retry with exponential backoff**:
   ```
   ($network-error) (%backoff 100 3000) retry { api-endpoint fetch-data }
   ```

3. **Fallback to cached data**:
   ```
   ($error) () fallback { api-fetch } { cache-fetch }
   ```

4. **Progressive fallback chain**:
   ```
   ($api-error) () fallback { primary-api } { ($api-error) () fallback { backup-api } { default-data } }
   ```

These patterns isolate error handling from business logic while maintaining Tacit's single-line style.

### 6.3 Polymorphism and Implicit Sources

Many Tacit transformers and sinks will automatically lift container values into sequences when needed. This polymorphism enables concise code where the container-to-sequence conversion is implicit.

Examples:

```
(1 2 3 4) map { -> x x 2 * }    \ Implicitly uses from-tuple
"hello" to-array              \ Implicitly uses from-string
```

This behavior can be customized or disabled in contexts where explicit conversion is preferred.

## 7. Lifecycle and Resource Management

Every source in a Tacit pipeline follows a well-defined lifecycle:

| Phase        | Description                                                                        | Stack Behaviour |
| ------------ | ---------------------------------------------------------------------------------- | --------------- |
| **Init**     | Source is instantiated; internal counters/handles are set to their starting state. | no values       |
| **Yield**    | Each pull produces one value **or** a sentinel.                                    | pushes value    |
| **Complete** | Source emits `$end` (or `$done`) and releases any transient resources.             | pushes sentinel |
| **Restart**  | If wrapped by `retry`, source is re-instantiated—**Init** runs again.              | resets state    |

Understanding the lifecycle of a source is crucial for proper resource management. Sources begin in an initialized state, yield values one at a time when pulled, and eventually complete by emitting a sentinel value. Some sources can be restarted, returning to their initial state.

### 7.2 Restartable vs. Non-Restartable Sources

| Source Type           | Restartable? | Notes                                                           |
| --------------------- | ------------ | --------------------------------------------------------------- |
| `range`, `from-tuple` | ✔︎           | Pure, deterministic; replays consistently.                      |
| `paginate`            | ✖︎           | Depends on external I/O; must be wrapped in `retry` or reopened |
| `retry` / `fallback`  | ✖︎‡          | Wrapper restarts its *inner* sequence; strategy state persists. |

‡ `retry` and `fallback` containers themselves are not restarted; they *restart or swap* the sequences they manage.

### 7.3 Resource Ownership

* **Buffers** passed into sources (e.g. `paginate`) are owned by the caller; cleanup is external.
* **File handles / sockets** opened inside a source must be closed during **Complete**.
* **Side-effect sinks** should flush or commit external actions before returning.

### 7.4 Best Practices

* Prefer restartable sources inside `retry` for simpler logic.
* Use sentinels (`$error`, `$wait`) to signal recoverable issues; `$end` for irreversible completion.
* Always ensure external resources are released in the **Complete** phase.
* When wrapping non-restartable sources, keep their creation inside the `retry` block so each retry re-opens them cleanly.
* For complex streaming operations, consider implementing a cleanup handler that runs regardless of how the sequence terminates.
* Document the restart behavior of custom sources to ensure correct usage in larger pipelines.

### 7.5 Summary

Sequences provide a complete iteration model that goes beyond traditional looping constructs. By defining iteration in terms of sources and transformers, Tacit enables higher-level reasoning about data flow and composition while still compiling to efficient low-level code.

## 8. Thinking in Sequences: A Translation Guide

Moving from imperative programming to Tacit's sequence-based approach requires shifting your mental model. This section provides translations for common programming patterns.

### 8.1 Loop to Sequence Translation

| Imperative Loop Pattern | Tacit Sequence Pattern |
|-----------------|----------------|
| Simple iteration with side effects | `(1 10) range map { dup * } for-each { print }` |
| Filtered accumulation | `0 (1 100) range filter { 2 mod 0 = } map { -> x x + x }` |

### 8.2 Conditional Branching to Sequence Operations

| Imperative Conditionals Pattern | Tacit Sequence Pattern |
|-------------------------|----------------|
| Filter then transform | `items filter { valid? } map { process } to-tuple` |
| Split into multiple streams | `numbers split { 0 >= } -> positives negatives` |

### 8.3 Exception Handling to Fallback Patterns

| Try-Catch Pattern | Tacit Sequence Pattern |
|-------------------|----------------|
| Simple try/catch | `($error) () fallback { primary-operation } { fallback-operation }` |
| Retry with fallback | `($error) (%backoff 3 0) retry { attempt-operation } ($error) () fallback { $value } { default-value }` |

### 8.4 Common Sequence Patterns

As you work with sequences, you'll recognize these idiomatic patterns:

| Pattern | Tacit Sequence Idiom |
|---------|----------------------|
| Transform-Filter-Aggregate | `source map { transform } filter { select? } fold { accumulate }` |
| Branch-Process-Merge | `source tee { process-a } { process-b } zip { combine }` |
| Try-Fallback-Chain | `($err) () fallback { primary } { fallback }` |
| Paginate-Filter-Limit | `buffer paginate { fetch-page } filter { relevant? } take 10 to-tuple` |

These patterns become the building blocks for expressing complex logic through clean sequence composition.
