# Sequences in Tacit

## Table of Contents
- [1. Introduction to Sequences](#1-introduction-to-sequences)
- [2. Capsules and Sequence Sources](#2-capsules-and-sequence-sources)
  - [2.1 Partially Applied Functions](#21-partially-applied-functions)
  - [2.2 Capsules as Stateful Functions](#22-capsules-as-stateful-functions)
  - [2.3 Calling Capsules](#23-calling-capsules)
  - [2.4 Sources as Capsules](#24-sources-as-capsules)
  - [2.5 Source Constructors](#25-source-constructors)
  - [2.6 Capsules Are Functions](#26-capsules-are-functions)
  - [2.7 Other Sources](#27-other-sources)
- [3. Transformers and Flow Control](#3-transformers-and-flow-control)
  - [3.1 Value Transformers](#31-value-transformers)
  - [3.2 Flow-Altering Transformers](#32-flow-altering-transformers)
  - [3.3 Flow-Combining Transformers](#33-flow-combining-transformers)
  - [3.4 Summary](#34-summary)
- [4. Control Stages: Status Tuples, Retry, and Fallback](#4-control-stages-status-tuples-retry-and-fallback)
  - [4.1 Status Tuples](#41-status-tuples)
  - [4.2 Retry Stage](#42-retry-stage)
  - [4.3 Fallback Stage](#43-fallback-stage)
  - [4.4 Summary](#44-summary)
- [5. Paginated Sources](#5-paginated-sources)
  - [5.1 Overview](#51-overview)
  - [5.2 Cursor Semantics](#52-cursor-semantics)
  - [5.3 Status Tuple Return](#53-status-tuple-return)
  - [5.4 Buffer Reuse and Emission](#54-buffer-reuse-and-emission)
  - [5.5 Integration with Retry and Fallback](#55-integration-with-retry-and-fallback)
  - [5.6 Use Cases](#56-use-cases)
- [6. Sink Stages — Consuming Sequences](#6--sink-stages--consuming-sequences)
  - [6.1 Side-Effect Sinks](#61-side-effect-sinks)
    - [6.1.1 `for-each`](#611-for-each)
    - [6.1.2 `print`](#612-print)
    - [6.1.3 `log`](#613-log)
    - [6.1.4 `emit`](#614-emit)
  - [6.2 Realization Sinks](#62-realization-sinks)
    - [6.2.1 `to-array`](#621-to-array)
    - [6.2.2 `to-tuple`](#622-to-tuple)
    - [6.2.3 `to-string`](#623-to-string)
  - [6.3 Terminal-Value Sinks](#63-terminal-value-sinks)
    - [6.3.1 `last`](#631-last)
    - [6.3.2 `fold`](#632-fold)
  - [6.4 Behavioural Notes](#64-behavioural-notes)
- [Conclusion](#conclusion)

## 1. Introduction to Sequences

Sequences in Tacit are composable programs that produce a series of values. You can think of them as functions that emit one item at a time. But unlike traditional iterators or generators, sequences in Tacit are built from values, not control flow. They’re designed to be used declaratively and to compose cleanly.

Tacit encourages a **point-free**, **stack-based** style. That means most of the time, you won’t name your data—you’ll build small programs that transform it step by step.

Instead of writing:

```
let result = []
for (let i = 0; i < 10; i++) {
  if (i % 2 === 0) result.push(i * 2)
}
```

You might write:

```
0 10 range
filter { 2 mod 0 eq }
map { 2 mul }
to-array
```

This is more than just syntax. Each line is a composable step. Each transformation has no memory of what came before. Every stage reads from upstream and emits to downstream.

Tacit doesn’t have a `for` loop. It doesn’t need one. The idea of a loop is replaced by a pull-based flow—each stage is responsible for asking for the next value when it needs it.

This pull model has a few important consequences:

* **Backpressure is natural**: if a downstream stage stops asking for values, upstream stages stop producing them.
* **Short-circuiting is easy**: if you want the first five items, you just `take 5` and stop.
* **Memory is minimal**: each stage processes one item at a time unless otherwise specified.

Underneath, all of this is built from capsules—small, stateful structures that behave like functions. But you don’t need to know how capsules work yet. What matters is that sequences can be constructed, composed, and run—all from ordinary stack code.

This chapter introduces the basic idea. The next chapters will build up each kind of sequence element—sources, transformers, and sinks—and show how they work together.

## 2. Capsules and Sequence Sources

All sequences in Tacit are built from capsules.

A **capsule** is a tuple whose final element is a function reference. The earlier elements are arguments or state values. When a capsule is invoked, its contents are unpacked and passed to the function, with the capsule itself optionally updated or reused.

At its core, a capsule behaves like a **partially applied function**. If you’re familiar with currying or closures, it’s similar—but more direct. A capsule is a value. You can assign it, move it, inspect it, and invoke it—all without special syntax.

### 2.1 Partially Applied Functions

Consider a simple function like `add`, which takes two numbers. In Tacit, a capsule can be used to "pre-fill" one of those numbers:

```
(1 @add) → a capsule called add1
```

Calling `add1` with another number completes the operation:

```
4  add1 eval → 5
```

This is function application by stacking: `4` goes on the stack, then the capsule unpacks `1` and calls `add`.

This idea—tuples holding data and a function—is the basis for all sequence operations.

### 2.2 Capsules as Stateful Functions

Capsules can do more than apply static arguments. They can hold state, and update it. This lets us model generators, counters, cursors—any value that evolves over time.

Tacit sequences use a special kind of capsule: a **self-modifying capsule**. These contain internal state (like a counter) and a function that both returns output and updates the state.

To be self-modifying, a capsule typically ends with a function like `@next`, which uses `->` to fetch and update fields inside the capsule. For example, a simple index capsule:

```
(0 @next-index)  → idx
```

Calling `idx` repeatedly yields `0`, `1`, `2`, and so on—each time returning the current value and bumping the counter.

The mutation is done in place. The function updates the field directly inside the capsule.

### 2.3 Calling Capsules

All capsules use a standard calling protocol. When you call a capsule, you push a **mode flag** before evaluation:

* `0` → initialize or reset
* `1` → step forward (get next value)

For example:

```
1  rng eval
```

The call `rng eval` pushes the mode and evaluates the capsule. The result is always a **conditional tuple**—a pair containing the output and a status code indicating whether the sequence is finished.

The actual format is:

```
(value done?)
```

Where `done?` is a Boolean. If `1`, the sequence is complete and no further values will be produced.

This pattern allows composable, pull-based iteration.

### 2.4 Sources as Capsules

Now that we have a model for stateful, callable tuples, we can define sources.

A **source** is just a capsule that produces values over time. It contains:

* internal state (like an index or limit)
* a `next` function that controls how values are generated

For example, `range` is a source:

```
(0 10 1 @range-next) → rng
```

This capsule starts at `0`, ends at `10`, steps by `1`. The `@range-next` function implements the logic.

Each call to `rng eval` with `1` yields the next number and a done flag:

```
1 rng eval → (0 0)
1 rng eval → (1 0)
...
1 rng eval → (9 0)
1 rng eval → (nil 1)
```

The final call returns `nil` with `1` to indicate the sequence is finished.

### 2.5 Source Constructors

You don’t need to build these capsules by hand. Tacit provides constructors like `range`, `from-tuple`, and `from-array`. Each returns a fully initialized capsule:

```
0 10 1  range     → capsule
(1 2 3) from-tuple  → capsule
```

These sources are independent, stateless outside themselves, and composable. Each one encapsulates its own state.

### 2.6 Capsules Are Functions

All sequences in Tacit are functions in capsule form. They are not objects, classes, or closures. They don’t require a heap or a runtime.

They are self-contained tuples with a final word that says "what to do" with the data inside.

This model scales: a source yields values. A transformer accepts a capsule and returns a new capsule. A sink consumes a capsule until it’s done.

Everything flows from this basic pattern.

Got it—I'll write section 2.7: Other Sources, as the final section of Chapter 2. One moment.


**2.7 Other Sources**

While `range` is the most illustrative example of a stateful source, Tacit provides several built-in ways to lift data structures into sequences. These are simpler than `range` in that they don’t require internal state mutation; instead, they yield each item in turn from a known memory structure. Each of these sources is constructed as a capsule and returns a status tuple on each invocation.

The most common are:

`from-tuple` – Converts a tuple into a sequence. Each call yields the next element until all are exhausted.

`from-array` – Works like `from-tuple`, but reads from a linear buffer using a view to determine bounds.

`from-string` – Treats a string as a character sequence. Each result is a tagged character value.

Each of these can be used directly:

```
(1 2 3)  from-tuple       → capsule
array    from-array       → capsule
"abc"    from-string      → capsule
```

When called with `0`, they reset. When called with `1`, they yield the next element and a flag.

This pattern allows them to be used interchangeably with `range`, forming the starting point for any sequence pipeline. Their construction is typically implicit—used just-in-time by transformer stages like `map`, but explicit invocation is always possible when more control is needed.

## 3. Transformers and Flow Control

A sequence is built by chaining stages together. Each stage is a capsule—a callable object—that produces one value per tick. In Chapter 2, we introduced *sources*, which are capsules that yield values from some internal store or rule, such as a counter or tuple. In this chapter, we focus on *transformers*—capsules that receive input from an upstream stage, perform some operation, and emit a modified or filtered version of the result.

Transformers sit in the middle of a pipeline. They mediate between source and sink, modifying either the data, the flow, or both. The pipeline itself is linear: each stage pulls from the stage before and pushes to the stage after. This means transformers only receive a value when the downstream stage asks for it, and they only request a value from upstream when they are ready to process one. Each transformer is therefore a synchronizing point—a flow-preserving, optionally modifying capsule that adheres to pull-based coordination.

Tacit defines three categories of transformer:

* *Value transformers*, such as `map` and `scan`, which modify or accumulate values without dropping or skipping.
* *Flow-altering transformers*, such as `filter`, `take`, and `discard`, which allow or suppress elements conditionally or based on counts.
* *Flow-combining transformers*, such as `zip` or `interleave`, which merge values from multiple upstreams into one output stream.

We cover each class in turn, beginning with the most straightforward: value transformers.

### 3.1 Value Transformers

The most common transformer is `map`. It applies a function to each item pulled from the upstream stage, producing one output per input. The block passed to `map` must have net arity zero—meaning it consumes one value and pushes one result, leaving the stack unchanged in depth.

For example:

```
(1 2 3) from-tuple map { add1 } to-array
```

This expression yields an array of `(2 3 4)`. The `add1` word increments each item. Since `map` operates lazily, the block is executed once per tick, and only when `to-array` pulls a value.

Because blocks may use local variables, `map` can also express more complex transformations:

```
(1 2 3) from-tuple map { -> x x mul2 } to-array
```

Here each input is bound to `x`, and the result is `x * 2`, yielding `(2 4 6)`.

The second major value transformer is `scan`, which maintains an internal accumulator and applies a binary operation to combine successive elements. For instance:

```
(1 2 3 4) from-tuple scan { add } to-array
```

Would produce `(1 3 6 10)`, computing cumulative sums. The block must again be net arity zero, but it receives both the current accumulator and the next input, returning the new accumulator.

Internally, `scan` is implemented as a self-modifying capsule that remembers the previous result and reuses it each tick.

Scan variants can be used to compute running maxima, string concatenations, or aggregate transformations. The essential behavior is always the same: emit a new result on every input, preserving length.

### 3.2 Flow-Altering Transformers

Flow-altering transformers may suppress outputs. The simplest is `filter`, which applies a predicate block to each item. If the predicate returns true (non-zero), the item is passed through; otherwise it is dropped.

For example:

```
(1 2 3 4 5) from-tuple filter { odd? } to-array
```

Yields `(1 3 5)`. The block receives each input and returns `1` if the number is odd.

The `take` transformer passes through the first `n` items, then stops emitting. For example:

```
(10 20 30 40) from-tuple 2 take to-array
```

Produces `(10 20)`. After two values, it stops pulling from upstream and terminates.

The `discard` transformer skips the first `n` items and emits the rest:

```
(10 20 30 40) from-tuple 2 discard to-array
```

Gives `(30 40)`. These count-based transformers track how many items have passed and alter the flow accordingly.

All flow-altering transformers preserve laziness. If downstream never requests more values, upstream is never pulled, and nothing is filtered or counted.

### 3.3 Flow-Combining Transformers

The third class of transformers combines multiple sources. The most basic is `zip`, which pulls one value from each upstream and produces a pair.

```
(1 2 3) from-tuple (4 5 6) from-tuple zip to-array
```

Yields `((1 4) (2 5) (3 6))`. Each tick pulls from both sources and constructs a tuple of two values. When either source terminates, `zip` terminates.

Variants like `interleave` or `merge` follow the same principle: coordinating two upstreams and emitting a unified stream. These are more complex internally, requiring synchronization between sources, but externally, they behave as just another transformer in the chain.

### 3.4 Summary

Transformers are composable units that transform, alter, or combine streams. They rely on capsules to encapsulate logic and internal state. Each transformer operates lazily, respecting downstream demand and upstream availability. Together with sources and sinks, they enable expressive, declarative dataflow pipelines with minimal overhead and high modularity.

## 4. Control Stages: Status Tuples, Retry, and Fallback

Sequence pipelines in Tacit rely on structured responses to track progress, signal completion, and handle exceptional conditions. These signals are encoded using *status tuples*—tagged pairs that represent a value and its current stream status. This chapter introduces the status tuple as a core convention, and defines two control stages, `retry` and `fallback`, which interpret status codes and respond accordingly.

### 4.1 Status Tuples

A *status tuple* is a pair of values returned by any stage in a pipeline. The first element is the result value. The second is a numeric status code that signals whether data is available, the stream has ended, or some other condition has occurred. These codes follow a fixed enumeration, with zero as the default signal for valid data.

These codes are:

* `0` – `ok`: A valid data value is present. The pipeline should continue.
* `1` – `done`: The stream has ended normally. No more data is available.
* `2` – `nil`: No data is available now, but the stream may be retried later.
* `3` – `end`: Final termination; no further retries are allowed.
* `4` – `retry`: Temporary failure; a retry is appropriate.
* `5` – `wait`: The source is waiting (e.g. on I/O); retry after delay.
* `6` – `error`: An unrecoverable error occurred. The pipeline should halt.

The values `0` and `1` are most common. Values `2` through `6` are used for advanced control and are typically interpreted by retrying or fallback logic. The number space is open-ended and reserved for future extension.

Status tuples are passed downstream with every call to a stage’s function. The consumer stage is expected to interpret or propagate the code.

### 4.2 Retry Stage

The `retry` stage provides robust control over upstream failures. It intercepts the status tuple emitted from its input, matches against known retry codes, and reissues a reset signal to upstream stages when appropriate. This signal is issued by calling the input with the flag `0`, which causes the source to reinitialize.

The `retry` stage takes two arguments before execution:

* A tuple of *trigger codes* — the list of status codes that should initiate a retry.
* A tuple representing the *strategy* — a named retry mode followed by its parameters.

For example:

```
(4 5) (fixed 3) retry
```

This instructs the pipeline to retry up to three times when it receives either `retry` (code 4) or `wait` (code 5) from upstream.

The available strategies are:

* `fixed n` — retry up to `n` times
* `timeout t` — retry until `t` milliseconds elapse
* `backoff base max` — retry with exponential backoff, starting from `base` ms and capping at `max` ms

The retry mechanism is external: it does not alter upstream state directly, but signals the source to restart by passing the `0` flag.

### 4.3 Fallback Stage

Unlike `retry`, which resets the upstream pipeline, `fallback` replaces it altogether. When triggered, it discards the current source and replaces it with a new one defined by a code block. This block is evaluated each time a fallback is triggered and should return a new source capsule.

`fallback` also takes two arguments:

* A tuple of *trigger codes* to match
* A tuple describing the fallback *strategy* (as above)

The `fallback` block must be defined after these arguments. The block returns a fresh sequence capsule, which replaces the failed source in place.

Example:

```
(4 6) (timeout 2000) fallback { new-sequence }
```

This causes the pipeline to switch to a new sequence if the upstream emits `retry` or `error`, and two seconds have elapsed since the first error.

Fallback is useful for hot-swapping sources, such as switching to cached data when live requests fail.

### 4.4 Summary

The status tuple is the standard way of signaling control flow and error conditions in Tacit pipelines. The `retry` and `fallback` stages use these signals to initiate recovery or substitution behaviors without disrupting downstream consumers. They are not transformers, as they do not alter values—they govern upstream state and replace failed stages when necessary.

No assumptions are made about how stages implement retryability. Stages that accept the reset signal (`0`) are considered retryable; others are treated as fixed. Retry and fallback logic is conservative and respects upstream contracts.

## 5. Paginated Sources

Some sequences cannot deliver their entire result set in a single call. When fetching data from a network service or a segmented resource like a file reader, the data must be retrieved in blocks. This is where `paginate` applies. It behaves as a **source stage** that wraps a block capable of performing page-wise data acquisition, returning one element per tick by scanning through a mutable buffer.

### 5.1 Overview

The form of a paginated source is:

```
<buffer> paginate { block }
```

The block must have the signature:

```
(cursor buffer → count new-cursor status)
```

Here:

* `cursor` is either a previous pagination token or `nil` if starting from the beginning.
* `buffer` is a reusable memory region the block fills with results.
* `count` is how many items in the buffer are valid.
* `new-cursor` is either another pagination token or `nil` if exhausted.
* `status` is a numeric status code following the standard status tuple model.

The buffer is treated as a circular or refillable queue by the `paginate` machinery, which steps through the valid entries and emits them one by one per tick.

### 5.2 Cursor Semantics

The `cursor` can be any Tacit value—typically a string or number—but it is only passed between invocations of the block and not used internally by `paginate` itself. The source logic controls its meaning entirely. This allows a wide range of use cases, from numeric offsets to opaque page tokens from HTTP APIs.

On the first call, `cursor` is `nil` unless overridden. On each subsequent refill, the `new-cursor` returned from the previous block invocation becomes the `cursor`.

If the `new-cursor` is `nil`, pagination is considered complete once the final buffer is exhausted.

### 5.3 Status Tuple Return

The return of the pagination block is interpreted as a **status tuple**. This means that the values `(count, new-cursor, status)` are internally converted into:

```
(count new-cursor → (count new-cursor status))
```

This enables standard status handling, including the ability to emit `retry`, `wait`, `error`, or `end` signals downstream.

For example, a block might return `(0 nil 3)` if no data was fetched, but the stream is still resumable (`nil` cursor, status `3 = nil`). A subsequent call to `paginate` would pass that `nil` cursor again and retry.

### 5.4 Buffer Reuse and Emission

The buffer passed to the block is mutable and reused between ticks. Only the `count` number of elements at the front of the buffer are considered valid. The `paginate` stage will emit these items one at a time, and when exhausted, invoke the block again to refill.

This model allows buffers to remain stack-local and avoids memory allocation on each page. Buffer content is overwritten on each refill unless preserved externally.

### 5.5 Integration with Retry and Fallback

Since `paginate` returns status tuples, it integrates naturally with `retry` and `fallback`. If the pagination block returns a status such as `retry`, a downstream `retry` stage can trigger re-invocation. If `error` is returned, a `fallback` stage may substitute an alternative source.

This means that pagination is not a special case—it’s a general source whose protocol aligns with the rest of the sequence system. All status handling is consistent across source types.

### 5.6 Use Cases

Typical scenarios include:

* Page-wise fetching from REST APIs using cursor-based or offset-based pagination.
* Incremental log readers from files or streams.
* Reading blocks from a database result set, stream, or device.

Each use case implements a custom pagination block, adapting the logic for buffering, cursors, and status codes to fit its domain.

## 6.  Sink Stages — Consuming Sequences

A **sink** is the final stage in a pipeline.
It pulls values from upstream capsules, performs its designated action, and does not emit further elements.
Because every upstream stage is lazy, *nothing executes until a sink begins pulling.*
Once a sink completes, the entire chain is finished.

Tacit defines three sink categories:

| Category           | Purpose                                | Typical words                       |
| ------------------ | -------------------------------------- | ----------------------------------- |
| **Side-effect**    | Act on each item, return no data       | `for-each`, `print`, `log`, `emit`  |
| **Realization**    | Materialize all items into a structure | `to-array`, `to-tuple`, `to-string` |
| **Terminal value** | Reduce the stream to one scalar        | `last`, `fold`                      |

Each sink obeys the **status-tuple contract**: it calls its upstream with flag `1` until the upstream returns a status code other than `0`, or until its own logic decides to stop early.
If an upstream status code is `6 (error)`, the sink must terminate without further pulls.

### 6.1 Side-Effect Sinks

Side-effect sinks execute a user block—or a predefined action—on every incoming value.
They return `nil`.

#### 6.1.1 `for-each`

```
sequence for-each { block }
```

* **Input** `sequence` — any capsule
* **Block** net-arity 0; receives each `value`
* **Effect** runs `block`, discards its result
* **Return** `nil`

Example:

```
(1 2 3) from-tuple for-each { log }          \ logs three lines
```

#### 6.1.2 `print`

```
sequence print
```

Short form of `for-each { -> x x . }`.
Writes each item to standard output.

#### 6.1.3 `log`

```
sequence log
```

Alias for `print`, intended for diagnostic streams.

#### 6.1.4 `emit`

```
sequence emit
```

Sends each item to a named coroutine channel.
`emit` returns `nil` after the upstream reports `done`.

### 6.2 Realization Sinks

Realization sinks consume the entire stream and build an in-memory result.

#### 6.2.1 `to-array`

```
sequence to-array
```

Accumulates all values in allocation order and returns an array.

Example:

```
10 range to-array          →  [0 1 2 3 4 5 6 7 8 9]
```

#### 6.2.2 `to-tuple`

```
sequence to-tuple
```

Collects values into a fixed tuple.

#### 6.2.3 `to-string`

```
byte-sequence to-string
```

Concatenates byte or character items into a UTF-8 string.

Realization sinks stop when the first non-zero status code (`1 done`, `3 end`, etc.) is received.

### 6.3 Terminal-Value Sinks

These sinks reduce or select a single scalar result.

#### 6.3.1 `last`

```
sequence last
```

Keeps the most recent value until upstream returns `done`, then returns that value.
If the sequence is empty, returns `nil`.

```
(10 20 30) from-tuple last    →  30
```

#### 6.3.2 `fold`

```
init sequence fold { reducer }
```

* **`init`** initial accumulator
* **`reducer`** net-arity 0 block; consumes `acc value` and returns new `acc`

Example (sum):

```
0 (1 2 3 4) from-tuple fold { add }   →  10
```

`fold` ceases pulling when upstream signals `done` or returns any non-zero status code.

### 6.4 Behavioural Notes

* A sink must inspect the **status code** of each tuple:

  * `0` → continue pulling
  * `1` → normal completion
  * `2 nil`, `3 end`, `4 retry`, `5 wait` may be forwarded to upstream logic or ignored, as appropriate
  * `6 error` → abort immediately
* Sinks do **not** propagate values further; they terminate evaluation.
* If a sink stops early (e.g. `take n` upstream satisfied), it must still read and discard any remaining buffered data to honour upstream contracts.

This completes the definition of sink stages and finalises the core sequence model: **sources → transformers → control stages → sinks**.

### Conclusion

Tacit’s sequence model is a self-contained, composable pipeline built from a single structural principle: the **capsule**—a tuple whose final cell is executable code.

* **Sources** are self-modifying capsules that yield one item per tick and report their state with a compact **status tuple**.
* **Transformers** wrap an upstream capsule to map, filter, combine, or otherwise reshape the stream while preserving laziness.
* **Control stages** (`retry`, `fallback`) interpret status codes to restart or replace upstream logic without breaking downstream flow.
* **Paginated sources** extend the model to chunked or cursor-based data, using the same status contract.
* **Sinks** terminate the pipeline, either producing side effects, realising the stream into a concrete structure, or computing a single scalar result.

Every stage follows the same calling convention, and every hand-off is a status tuple whose final slot is an agreed code. This uniformity makes pipelines predictable, debuggable, and trivial to extend—all without special syntax or hidden machinery. Tacit’s sequences therefore provide a declarative, point-free foundation for iteration, control flow, and resource-safe streaming across the entire language.

