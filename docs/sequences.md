# Sequences in Tacit

## Table of Contents
- [Sequences in Tacit](#sequences-in-tacit)
  - [Table of Contents](#table-of-contents)
  - [1. The Sequence Model](#1-the-sequence-model)
  - [2. Capsules and Sequence Sources](#2-capsules-and-sequence-sources)
    - [2.1 Partially Applied Functions](#21-partially-applied-functions)
    - [2.2 Capsules as Stateful Functions](#22-capsules-as-stateful-functions)
    - [2.3 Calling Capsules](#23-calling-capsules)
    - [2.4 Sequence Sources Begin with `sequence`](#24-sequence-sources-begin-with-sequence)
    - [2.5 Range as a Stateful Source](#25-range-as-a-stateful-source)
    - [2.6 Tuple-Driven Flow Control](#26-tuple-driven-flow-control)
    - [2.7 Other Sources](#27-other-sources)
    - [2.8 Extended Status Codes](#28-extended-status-codes)
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
  - [6.  Sink Stages — Consuming Sequences](#6--sink-stages--consuming-sequences)
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

## 1. The Sequence Model

Tacit is a stack-based programming language built around values, not variables. Its control flow, data structures, and functions all converge on a single idea: **composable tuples with embedded logic**.

Nowhere is this clearer than in its treatment of sequences. A Tacit sequence is not an object, not a class, and not a closure. It is a **tuple**, with a **function reference** at the end, and it behaves like a function every time it is evaluated.

This chapter introduces the basic idea. The next chapters will build up each kind of sequence element—sources, transformers, and sinks—and show how they work together.

## 2. Capsules and Sequence Sources

All sequences in Tacit are built from capsules.

A **capsule** is a tuple whose final element is a function reference. The earlier elements are arguments or state values. When a capsule is invoked, its contents are unpacked and passed to the function, with the capsule itself optionally updated or reused.

At its core, a capsule behaves like a **partially applied function**. If you’re familiar with currying or closures, it’s similar—but more direct. A capsule is a value. You can assign it, move it, inspect it, and invoke it—all without special syntax.

### 2.1 Partially Applied Functions

In Tacit, the primary abstraction for composition is the capsule. A capsule is a tuple whose final item is a function reference. The preceding items are arguments—either static inputs or mutable state fields. When the capsule is evaluated, the arguments are unpacked onto the stack, and the function is invoked in that context.

This model naturally supports partially applied functions. For instance, consider a binary function like `add`, which expects two numbers. By creating a capsule that stores one of those numbers, we effectively bind the first argument:

```
(3 @add)
```

This tuple represents a capsule that adds three to whatever value is passed to it. When evaluated, the capsule pushes `3` onto the stack, then executes the `@add` function, which expects one more argument from the stack.

For example:

```
4  (3 @add) eval
```

This yields `7`. The number `4` is pushed first, followed by the capsule. The capsule unpacks `3`, leaving `4 3` on the stack, and then `@add` consumes both to produce the result.

Capsules in Tacit are not closures. They do not capture lexical scope or retain access to external variables. Instead, all their behavior is derived from the tuple structure itself. The function at the end of the capsule operates strictly on the contents of the tuple and the current stack.

This makes capsules highly predictable: their inputs and effects are explicit and confined to their tuple. They can be created, passed around, evaluated multiple times, or embedded in other structures without side effects or hidden bindings.

In summary: a partially applied function in Tacit is just a capsule. Tuples encode the data. The function reference encodes the behavior. This pattern is the foundation for sequences, transformers, and all higher-level flow control.

### 2.2 Capsules as Stateful Functions

Capsules are not limited to fixed arguments. They can also maintain and update internal state. This makes them suitable for modeling evolving values—like counters, cursors, accumulators, or iterators—entirely within the tuple itself.

To create a stateful capsule, the tuple includes state fields before the final function reference. That function is responsible for reading, modifying, and returning those fields. Importantly, the capsule is **self-modifying**: the function operates on the tuple that contains it.

For example, a simple counter capsule might look like:

```
(0 @next-index)
```

Here, `0` is the initial counter value. The function `@next-index` is designed to read the current value, emit it, and increment it. When the capsule is evaluated, it mutates the `0` to `1`, then `2`, and so on, each time producing the previous value.

Evaluating it repeatedly:

```
1  (0 @next-index) eval    → (0 0)
1  eval                    → (1 0)
1  eval                    → (2 0)
```

Each result is a conditional tuple: the value and a done flag. In this case, the flag remains `0` because the sequence continues indefinitely. The counter increments in place.

This is possible because the function has access to its own tuple through the calling convention. Instead of relying on closures to hold the internal variable, the tuple serves as the container for state. The function uses primitives like `->` (to read and write fields) to access its own structure.

There are no hidden environments. There is no captured scope. All state is held transparently inside the tuple and modified through explicit operations. This makes reasoning about behavior simple and debugging straightforward.

Every time a self-modifying capsule is evaluated, it updates itself. This forms the backbone of Tacit’s approach to defining sources, streams, and dynamic behaviors—entirely without object-oriented classes or lexical closures.

### 2.3 Calling Capsules

Capsules are evaluated by placing a mode flag on the stack and invoking the capsule. The mode determines what the capsule should do—typically, whether it should reset itself or yield the next value.

Tacit uses two standard mode flags:

* `0` — reset: reinitializes the capsule's internal state.
* `1` — step: advances the capsule and produces the next output.

This calling protocol allows capsules to behave predictably in any context. The pattern is simple:

```
1  capsule eval
```

That call sends the `1` mode flag and causes the capsule’s function to execute using the values stored inside it. The result is a **conditional tuple**:

```
(value done?)
```

The first element is the current output. The second is a Boolean flag—`1` means the sequence is finished, `0` means more values are available.

This form of conditional tuple is the universal contract between stages. Any function or transformer that consumes a sequence reads one of these status pairs at a time. The structure also supports short-circuiting, because a stage can stop requesting values once it sees `done? = 1`.

For example, using a simple counter capsule:

```
(0 5 1 @range-next) → counter
```

Calling `counter` repeatedly with `1` would yield:

```
1 counter eval  → (0 0)
1 counter eval  → (1 0)
1 counter eval  → (2 0)
1 counter eval  → (3 0)
1 counter eval  → (4 0)
1 counter eval  → (nil 1)
```

Each call advances the internal index and produces a new value, until the end is reached.

This protocol is what allows sequences to be composed modularly. Each stage has no idea what produced its input or where its output will go. It simply consumes a conditional tuple and emits another—or passes it along.

This keeps the model lazy, restartable, and uniform across all kinds of sources and transformers.

### 2.4 Sequence Sources Begin with `sequence`

All sequence pipelines in Tacit must begin with the `sequence` keyword. This is not just a formality—it creates the execution context that ensures each pipeline runs within its defining function and cannot escape into an outer scope.

When you invoke `sequence`, it produces a new **sequence handle**, a capsule that serves as the root of the pipeline. Every stage that follows—such as `range`, `from-tuple`, `map`, or `filter`—must consume and extend this handle. This ensures all state and local variables remain confined to the function in which the sequence was built.

For example:

```
sequence
  0 10 1 range
  ...
```

Here, `sequence` creates the pipeline context. The `range` stage takes that handle and attaches a source capsule to it. This capsule includes internal state (like the current index and end limit), and a reference to the `@range-next` function that drives it.

What makes this powerful is that **each stage returns a new handle**, updated with its stage capsule and bound to the same original context. This lets us construct pipelines incrementally while maintaining functional boundaries.

If the resulting pipeline is ever passed to a different function, its `bp` (base pointer) check will fail, and it won’t run. This ensures correctness without needing closures or captured environments.

**Key point**: Every pipeline is a capsule chain rooted in a sequence handle. This makes it lazy, self-contained, and function-context-aware from the start.

### 2.5 Range as a Stateful Source

The most fundamental source in Tacit is `range`. It creates a capsule that yields numbers from a starting point to an endpoint, incrementing by a given step. Unlike an eager list or array, `range` is a pull-based source: it only produces a value when asked.

Let’s walk through a minimal example:

```
sequence
  0 10 1 range
```

The `range` combinator consumes the current sequence handle, appends a new capsule to it, and returns an updated handle. That capsule contains the start, end, step, and current index, along with a pointer to the `@range-next` function.

When executed by a sink (like `foreach`), the `@range-next` function is called repeatedly with mode `1` to fetch the next item. Each time, it checks whether the current index is within bounds. If so, it returns a **conditional tuple**:

```
(value done?)
```

Where `done?` is `0` while values remain, and `1` when the sequence is finished.

For example, the output from this pipeline:

```
sequence
  0 3 1 range
  foreach { . }
```

Would print:

```
0
1
2
```

The `range` capsule mutates its index in place each time it runs. This is safe because the whole pipeline is local to the function and governed by the original `sequence` handle. No copying, no closures—just a compact self-contained state machine.

Perfect. Here’s **Section 2.6**.

---

### 2.6 Tuple-Driven Flow Control

Every sequence capsule in Tacit returns a **conditional tuple** on each step: a pair of values indicating the result and whether the sequence has finished. This is fundamental to how transformers and sinks operate—they don’t receive special signals or callbacks. They just evaluate the upstream capsule and look at the tuple.

The standard format is:

```
(value done?)
```

Where `done?` is either `0` (more values to come) or `1` (no more values).

Transformers use this structure to decide what to do next. For example, a mapping stage might look like this:

```
sequence
  0 10 1 range
  map { 2 mul }
  foreach { . }
```

The `map` combinator wraps a new capsule around the previous one. When its `@map-next` function is invoked, it calls its upstream with mode `1`, receives a conditional tuple, and—if not done—applies the mapping block to the value. The result is returned as a new conditional tuple. If the upstream is done, `map` passes that `done` signal straight through.

This makes each stage completely responsible for its own state and evaluation. There’s no scheduler, no coroutine, no external control flow—just tuples being passed and updated in-place.

Because the done flag is explicit, short-circuiting becomes simple. A stage like `take` just counts how many values it has seen and flips the done flag early. A stage like `filter` skips values until one matches, then returns normally.

This tuple pattern gives Tacit its **lazy** but **imperative** style: each call to a sequence capsule is a single step, and control flow is handled with simple values.

Great—here’s **Section 2.7: Other Sources**, now fully aligned with the updated tuple-based, closure-free model.

---

### 2.7 Other Sources

While `range` illustrates how sequences can maintain internal state, Tacit also provides sources that operate over fixed memory—tuples, arrays, and strings—without modifying any external context. These sources are constructed through the same capsule mechanism and emit conditional tuples on each step.

Each of these sources must still be part of a valid sequence context, beginning with the `sequence` combinator. That context ensures any upstream pointer relationships and execution boundaries are respected. No source can operate outside a sequence; doing so will fail the boundary check.

**Tuple source**:

```
sequence
  (1 2 3 4) from-tuple
  foreach { . }
```

This iterates over a static tuple. Each call to its `@next-tuple` function returns the next element and a flag indicating completion. The tuple itself is not modified.

**Array source**:

```
sequence
  buffer-view from-array
  foreach { . }
```

Here, a view over a linear memory buffer—created separately—is passed to `from-array`, producing a capsule that reads from that memory region one element at a time.

**String source**:

```
sequence
  "hello" from-string
  foreach { . }
```

Each step yields a character tagged with the `char` tag. The string is treated as immutable; the capsule simply walks its byte positions until the end.

All these sources implement the same interface: they return `(value done?)` tuples, they maintain no external context, and they cannot outlive their sequence environment. Because of this, they can be composed with transformers and sinks just like `range`.

### 2.8 Extended Status Codes

In standard usage, a source returns a tuple of the form:

```
(value status)
```

where `status` is typically either `0` (continue) or `1` (done). But this status value is not limited to a Boolean signal. Tacit permits richer status codes to be emitted from sources, enabling more expressive control over downstream behavior.

This model treats the second element not merely as a termination flag, but as a general-purpose status indicator. In the simplest case, `0` means “keep going” and `1` means “stop.” But other values can encode conditions such as:

* a soft error
* a skipped value
* a retry recommendation
* a diagnostic signal
* a custom early-exit request

For example, a source may return:

```
(nil 2)   — indicating a transient failure
(nil -1)  — signaling to retry without advancing state
(value 42) — a domain-specific marker the pipeline can interpret
```

Downstream combinators—like `map`, `filter`, or even `foreach`—can check the status and decide whether to propagate, suppress, handle, or react to it. The exact handling logic is context-dependent but consistent with the principle of local responsibility: each stage interprets status codes from its upstream source.

This extension does not change the structure of sequence capsules. It simply expands the contract between stages. The `value` remains a tagged data item; the `status` remains a numeric flag, but one whose meaning can be extended as needed.

By allowing general status codes, Tacit supports more nuanced pipelines without abandoning the composability and pull semantics of the sequence model.




















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

