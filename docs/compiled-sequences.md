# Compiled Sequences

1. Design Philosophy
2. Stages and Structure
3. Emission Model and Control Flow
4. Patch System (Minimal Jump Resolution)
5. Recursive Codegen
6. Forking and Multi-Fork Behavior
7. Restartable Sources
8. Control and Semantics of Restart
9. Structured Block Compilation
10. The `unpack` Stage
11. The `pack` Stage
12. Restart, Retry, and Error Propagation
13. Patch Model Validation
14. Codegen Examples
15. Codegen Emission Rules and Stage Emission Metadata
16. Summary Commit

### 1. Design Philosophy

This specification defines the compiled sequence system in the Tacit programming language. Sequences in Tacit are declarative pipelines of staged computation, compiled into a fully interleaved, single-pass stream of low-level code. The model emphasizes clarity, performance, and structure over stack-centric tricks or deferred scheduling.

The core principles of the sequence system are:

* _Structured streaming_: All sequences are composed of clearly defined stages that operate in a streamed manner—one item at a time, with control explicitly advancing between stages.

* _Stage-local clarity_: Each stage operates with clearly scoped local variables. The stack is used only to pass values between stages, not for within-stage control or logic.

* _Deterministic flow_: Every transition—between stages or within loops—is implemented through statically compiled forward jumps. The flow of control is explicit and fully linear.

* _Fully interleaved, single-pass codegen_: Code for each stage is emitted inline, in the order it appears in the source pipeline. There are no multiple passes, no buffering, and no scheduler.

* _Restartable by design_: All sequence sources, including higher-order constructs like `restart`, emit code in a way that naturally supports re-entry and retries without any special runtime state.

* _Recursive compilation of blocks_: Structured blocks within stages (such as in `map`, `for-each`, or `restart`) are compiled recursively. Each nested block produces its own `init`, `next`, and loop structure, fully scoped and isolated from its parent.

This system enables deterministic, minimal, and efficient execution of pipelines with first-class support for transformation, filtering, forking, batching, retrying, and structured block execution. It is designed to be easy to reason about and debug while remaining expressive and restart-safe.

### 2. Stages and Structure

Tacit sequences are constructed from a series of _stages_, each of which performs a distinct role in the flow of data. Every sequence is built from these stages, chained together to form a linear, streaming pipeline.

Stages fall into three primary categories:

* _Source_: A stage that produces values. It may be static (e.g., `range`), procedural (e.g., `restart`), or driven by external input (e.g., `http-get`).

* _Processor_: A stage that transforms, filters, combines, or otherwise operates on incoming values. Examples include `map`, `filter`, `zip`, `pack`, and `unpack`.

* _Sink_: A terminal stage that consumes values and does not produce further output. This includes stages like `print` or `for-each`.

#### Stage Code Structure

Each stage is compiled into two code blocks:

* `init_stage`: one-time initialization logic for the stage
* `next_stage`: logic that executes once per item processed or produced

These two blocks are emitted _back-to-back_ during code generation. The `init` block always ends with a forward jump to the next stage’s `init`, and the `next` block ends with a jump to the next stage’s `next`.

This structure guarantees that:

* Code is emitted _in order_, as a single stream.
* Each stage is _self-contained_ in its setup and iteration logic.
* No scheduler or runtime staging system is needed.

#### Interleaving and Flow

Because both `init` and `next` blocks for each stage are emitted together and inline, Tacit's compiled sequences support complete interleaving. This means that even deeply nested or complex pipelines result in a flat, linear, directly executable code block with forward-only jumps and no deferred binding.

### 3. Emission Model and Control Flow

The Tacit sequence system compiles pipelines into a single forward-emitted stream of code, consisting entirely of `init` and `next` blocks per stage. The emission process is strict, minimal, and single-pass.

#### Emission Rules

For each stage:

1. Emit `init_stage` block.
2. Emit `next_stage` block.
3. Emit `jump` instructions at the end of each to forward-control to the next stage’s corresponding block.

The compiled code always begins with:

```tacit
main:
  jump init_first_stage
```

This establishes the entry point for the sequence.

Each `init` block ends with a jump to the `init` block of the next stage. Each `next` block ends with a jump to the `next` block of the next stage.

The final stage's `init` block jumps to the _loop start_—which is always the `next` block of the first stage. This ensures entry into the main processing loop after all initializations.

The final stage’s `next` block also jumps to the loop start, completing the pipeline cycle.

#### Flow Control Summary

* All jumps are forward-only.
* There is no recursion in control flow.
* All connections between stages are determined during codegen.
* There is no runtime dispatcher or backtracking logic.

The result is an executable code stream where every part of the sequence is laid out explicitly, and the flow between stages is both predictable and immediate.

### 4. Patch System (Minimal Jump Resolution)

To enable forward-only, single-pass code generation, Tacit uses a _minimal patching system_ based on three local variables per compilation scope. These track unresolved jump destinations during emission and are resolved once the corresponding target blocks are emitted.

#### Patch Variables

Each code generation scope maintains the following patch variables:

* `pending_init_patch`: a temporary variable for the unresolved jump at the end of an `init_*` block.
* `pending_next_patch`: a temporary variable for the unresolved jump at the end of a `next_*` block.
* `loop_start`: records the address of the first emitted `next_*` block, which becomes the loop reentry point.

#### Patching Behavior

* When an `init_*` block emits a jump to a yet-unemitted `init_next_stage`, the jump location is stored in `pending_init_patch`.
* When a `next_*` block emits a jump to a yet-unemitted `next_next_stage`, it is recorded in `pending_next_patch`.
* When the corresponding target block is later emitted, the compiler resolves the patch by inserting the address into the jump instruction.

`loop_start` is recorded as soon as the first `next_*` block is emitted. It is used to:

* Close the loop from the final stage back to the beginning
* Provide a well-defined reentry point for restarting sequences

This system ensures all control flow is resolved during forward emission, with no need for label declarations or backpatching tables. Each stage cleanly hands off to the next using just these three local values. Nested stages (compiled via recursion) manage their own scoped patch variables independently.

### 5. Recursive Codegen

Tacit supports recursive code generation to handle structured blocks within stages—such as those found in `map`, `for-each`, or `restart`. These blocks represent nested sequences that must be compiled as independent, embedded pipelines.

#### Recursive Compilation Model

When compiling a structured block:

* A new code generation context is entered.
* It uses its own set of `pending_init_patch`, `pending_next_patch`, and `loop_start` variables.
* The code is emitted inline, immediately following the outer stage's code.
* The recursive generator emits `init_*` and `next_*` blocks for the nested sequence just like any top-level sequence.

#### Return Protocol

At the end of the nested block’s compilation, the following _three addresses_ are pushed onto the stack (in order):

1. `loop_start`: the address of the first `next_*` block inside the nested sequence.
2. `next_stage`: the main entry point to the nested `next_*` logic.
3. `init_stage`: the address of the nested block’s initializer.

These addresses are then popped by the parent stage in reverse order and used to wire up control flow, such as jumping from an outer `next_map:` block into the nested `init_restart:`.

#### Example Usage

In a structure like:

```tacit
map {
  restart {
    http-get (url with page=$x)
  }
}
```

The `restart` block is compiled recursively. After emission, its `init`, `next`, and loop entry are pushed to the stack, and the enclosing `map` stage pops them to insert a jump to begin the nested flow.

#### Isolation and Safety

Because each recursive block operates in its own scope:

* Patch variables do not conflict
* The outer pipeline is unaffected by the internal structure of the block
* Restartable or nested pipelines are safe and deterministic

Recursive codegen is the mechanism that makes staged blocks composable, restartable, and independently rewired without requiring label systems or stack depth analysis.

### 6. Forking and Multi-Fork Behavior

Tacit supports forking via the `fork` stage, which duplicates a value and distributes it to multiple parallel branches. Forks are not control-flow constructs—they operate on _values_, not execution paths.

#### Semantics

When a `fork` is encountered:

* The incoming value is _duplicated_ and passed independently to each branch.
* Each branch is treated as a complete sub-sequence with its own `init` and `next` blocks.
* These branches are compiled _inline_ and _back-to-back_, preserving the order of the source pipeline.

For example:

```tacit
fork {
  { map { square } }
  { filter { even? } }
}
```

This fork:

* Sends the original value to both `map` and `filter`.
* Emits their compiled stages consecutively.
* Connects them via a `mask` or `zip` depending on the parent context.

#### No Stack or Branch Tracking Required

Because forks operate by duplicating values, they do not require:

* Call/return management
* Stack manipulation
* Named branches or continuations

All control flow continues forward. Each branch emits its own `init_*` and `next_*`, and downstream stages rejoin as dictated by the structure (e.g., in a `zip`, `mask`, or sequence merger).

#### Composition

Nested forks (e.g., a fork inside one branch of another fork) are supported seamlessly. The compiler simply expands each branch recursively and wires the resulting code into the parent pipeline.

This allows for complex fanout and recombination patterns while maintaining a fully linear, forward-only code structure.

### 7. Restartable Sources

The `restart` construct introduces a source stage that can be retried if it fails or produces an invalid result. It is especially useful in networked or fallible contexts where operations may need to be retried transparently.

#### Purpose

A `restart` block encapsulates logic that may:

* Fail on the first attempt (e.g., due to network issues)
* Return a sentinel or `nil` value requiring re-execution
* Need to regenerate data for each iteration independently

It behaves like any other source stage in terms of code structure, but its internal control flow includes a self-loop to its own `init` block in case of retry.

#### Structure and Behavior

A typical `restart` stage emits:

* `init_restart`: initializes local state (e.g., URL or parameters)
* `next_restart`: performs the attempt, checks for failure, and either:

  * Proceeds with a value
  * Or jumps back to `init_restart` to retry

#### Example Pattern

```tacit
restart {
  http-get $url
}
for-each { print }
```

Generates:

```
init_restart:
  $url -> $target
  jump next_restart

next_restart:
  http-get $target -> $result
  if $result == nil:
    jump init_restart
  $result -> $x
  jump next_sink
```

This pattern guarantees that failure is invisible to the outer sequence—the retry logic is entirely internal to the stage.

#### Reentrancy and Isolation

Each `restart` block:

* Has its own `loop_start`
* Returns `init`, `next`, and loop addresses when compiled recursively
* Can be safely used inside `map`, `filter`, or other recursive structures

The retry mechanism is entirely static. There is no dynamic state machine, and no runtime handler is required. Restartable blocks are _compiled as loops_, not interpreted as behaviors.

### 8. Control and Semantics of Restart

The `restart` block in Tacit is more than a retry mechanism—it is a structured, restartable _source sequence_ that integrates cleanly into the rest of the pipeline model.

#### Restart as a Source

A `restart` block always behaves as a source: it emits one value at a time, and it is responsible for ensuring that this value is valid before forwarding it downstream. If the block determines that the value is invalid (e.g., it is `nil`, an error marker, or fails a condition), it re-invokes itself by jumping to its own `init`.

This gives the block complete control over re-execution and failure recovery.

#### Predicate-Based Restart

A restart can be governed by a condition directly within its `next` block:

```tacit
restart {
  fetch -> $result
  if $result == nil:
    retry
  $result
}
```

The codegen for this block includes:

* Assignment
* Conditional check
* A forward jump to the stage’s own `init` block if retry is needed

This makes `restart` deterministic and declarative: retries are based on data and logic, not external signals.

#### Parameterization and Reuse

Because restarts are local and structured, they can:

* Capture external parameters (e.g., `$url`, `$page`)
* Be reused across iterations (e.g., in a `map`)
* Produce consistent output types downstream

#### Restart and Reentry

Every `restart` block manages its own reentry point. It begins at its own `init`, loops via its own `next`, and re-emits itself as needed. Its output is guaranteed to be singular per success path—only one valid result is passed on per iteration.

This model ensures that:

* Retried attempts are local to the `restart` block
* No outer loop or stage is aware of retry behavior
* State is preserved across retries via local variables

This makes `restart` a reliable building block for handling fallible, delayed, or retryable computations within larger pipelines.

### 9. Structured Block Compilation

Tacit stages can include code blocks—such as those passed to `map`, `for-each`, or `restart`—that define structured, embedded sequences. These blocks are compiled as _independent sub-sequences_, using the same `init`/`next`/`loop_start` structure as top-level pipelines.

#### Compilation Process

When a stage receives a block (e.g., `map { ... }`), the compiler:

1. Recursively enters a new codegen context.
2. Emits the block’s stages as if it were a top-level sequence:

   * Emits `init_*`, `next_*`, and jump logic as usual.
   * Assigns and tracks a fresh set of patch variables.
3. Pushes the resulting addresses (`loop_start`, `next`, `init`) to the stack in that order.

The parent stage then pops those values and uses them to wire up its own control flow to the nested logic.

#### Scoping and Isolation

Each block:

* Has its own local patch variables and state.
* Is fully isolated from its surrounding stage in terms of jump logic.
* Can freely contain its own source, processors, and even sink logic if needed.

Because blocks are compiled as ordinary sequences, _nested restarts_, _embedded forks_, and even _reentrant mini-pipelines_ can be expressed naturally inside block bodies.

#### Example: Factorial via Reduce in a Map

```tacit
map {
  restart {
    range 1 $n
    reduce { * }
  }
}
```

This nested structure compiles:

* A `range` and `reduce` pair inside a `restart`
* Inside a `map` that may be part of a broader sequence

Each layer emits its own `init` and `next` blocks, and each reconnects cleanly via stack-based wiring after recursive compilation.

#### Guarantees

* All blocks are compiled into the same output stream
* No labels or second passes are needed
* Structured blocks are treated as full sub-sequences with reliable reentry

Structured blocks form the foundation for composability in Tacit. They allow complex control and restart behavior to be embedded within pipeline logic without any additional runtime mechanism.

### 10. The `unpack` Stage

The `unpack` stage transforms a single collection value (such as a list or array) into a sequence of individual items. It acts as a bridge between stages that emit aggregate values and stages that expect a one-item-at-a-time stream.

#### Purpose

Some sources—particularly `restart` blocks or networked operations—produce collections rather than scalar values. These need to be broken down into item-wise sequences to continue processing. `unpack` handles this transformation declaratively.

#### Behavior

`unpack` takes a value like `[a, b, c]` and emits:

```
a
b
c
```

Each item is sent to the next stage one at a time.

#### Example

```tacit
restart {
  fetch
}
unpack
for-each { print }
```

This compiles to code that:

* Receives a list from `fetch`
* Iterates through it using a local index
* Emits one value per loop iteration

#### Codegen Pattern

* `init_unpack`: stores the list and sets index to 0.
* `next_unpack`: checks if index is less than count, emits current item, increments index.

The code fits within the standard stage structure:

```tacit
init_unpack:
  $list -> $seq
  0 -> $i
  len $seq -> $count
  jump next_unpack

next_unpack:
  if $i >= $count:
    jump next_stage
  $seq[$i] -> $x
  $i += 1
  jump next_sink
```

#### Integration

`unpack` emits only one value per iteration and is stateless beyond the internal cursor. It cleanly integrates into any pipeline and supports:

* Downstream processors like `map`, `filter`
* Sinks like `print`, `for-each`
* Further staging, including restartable consumers

Because it emits using `init` and `next`, `unpack` follows the same patching model and can be chained or nested freely. It does not require buffering or dynamic allocation—just simple iteration logic.

### 11. The `pack` Stage

The `pack` stage is the structural inverse of `unpack`. It collects individual items from an incoming stream and groups them into batches of a fixed size. Once a full group is formed, it emits the entire collection as a single value.

#### Purpose

Where `unpack` is used to serialize a collection into a stream, `pack` is used to:

* Buffer and batch values
* Accumulate inputs for grouped processing
* Prepare payloads for transmission (e.g., bulk API requests)

It is useful in both functional and practical scenarios, such as batching items for performance, network transmission, or downstream aggregation.

#### Behavior

Given a stream like:

```
1 2 3 4 5 6 7
```

A stage `pack 3` will emit:

```
[1, 2, 3]
[4, 5, 6]
[7]
```

The final group may be smaller than the target batch size, but it is still emitted at the end of input.

#### Example

```tacit
range 1 10
pack 3
for-each { print }
```

#### Codegen Pattern

* `init_pack`: initializes an empty group and sets the group size
* `next_pack`: adds incoming values to the group

  * If the group reaches the specified size, it is emitted and the group resets
  * At the end of the upstream input, the current group (if non-empty) is emitted

```tacit
init_pack:
  [] -> $group
  3 -> $group_size
  jump next_input

next_pack:
  $group + $x -> $group
  len $group -> $count
  if $count < $group_size:
    jump next_input
  $group -> $batch
  [] -> $group
  jump next_sink
```

#### Final Flush

When the upstream signals completion, `next_pack` is invoked one last time to check for and emit any remaining items. This is achieved by jumping directly to `next_pack` at stream end.

#### Integration

`pack` is a stateful processor stage and fits naturally within the `init`/`next` pattern. It uses only local variables and integrates cleanly with all upstream and downstream stages.

It respects the three-variable patching model and does not require buffering outside of its local group accumulator. This makes it predictable, restart-safe, and fully stream-aligned.

### 12. Restart, Retry, and Error Propagation

Tacit’s `restart` stage allows structured retry logic to be embedded in pipelines without requiring dynamic handlers, label-based control flow, or external supervisors. However, in real-world sequences, not all retries are triggered the same way. Tacit supports a range of restart and error handling patterns through composition and predicate logic.

#### Predicate-Based Retry

A `restart` block can inspect its result and decide whether to retry:

```tacit
restart {
  http-get $url -> $result
  if $result == nil:
    retry
  $result
}
```

The `retry` is implemented as a `jump init_restart`, meaning the entire source sequence is re-invoked from scratch.

#### End-of-Data and Retry Semantics

Sometimes a result is not an error but a signal of completion. Tacit treats these cases identically: a `restart` can choose to:

* Retry again (e.g., if a result is empty)
* Forward the current result
* Halt or complete the stage

This logic is entirely under the control of the `restart` block.

#### Restartable Blocks as Error Handlers

`restart` blocks can be used to wrap unstable logic. For instance:

```tacit
map {
  restart {
    fetch-sensitive
  }
}
```

This encapsulates a fallback or retry mechanism inside the transformation itself, meaning the retry logic does not pollute the outer sequence.

#### Parameter Mutations for Pagination or Cursors

Restart blocks may evolve their internal parameters between retries, such as incrementing a page number or updating a cursor:

```tacit
restart {
  $cursor -> $prev
  fetch-page $prev -> $result
  if $result == nil:
    retry
  extract-cursor $result -> $cursor
  extract-items $result
}
```

Each retry reuses and updates internal state using standard local variable logic.

#### Controlled Failures

Tacit does not automatically halt on error. Instead, failure handling is expressed structurally using:

* `if` conditions
* Branching (`jump`)
* Optional logic and fallback within the pipeline

By embedding failure checks and loops directly in the sequence structure, the language avoids exceptions or signal-based error propagation.

#### Summary

* Restarts are data-driven, scoped, and structured
* Retry behavior is transparent and under developer control
* Errors are modeled as values, not exceptions
* Retry policies, page cursors, and fallbacks are easily encoded using locals and flow control within the block

This approach makes restart logic explicit, reliable, and integrable with the rest of Tacit’s sequence system.

### 13. Patch Model Validation

Tacit’s compiled sequence system relies on a strict, minimal patching model. This section demonstrates that the _three-variable patch system_ is fully sufficient for compiling arbitrary pipelines—whether simple, nested, forked, or restartable.

#### Recap of Patch Variables

Each compilation scope maintains:

* `pending_init_patch`: stores unresolved `jump init_*` during emission
* `pending_next_patch`: stores unresolved `jump next_*` during emission
* `loop_start`: records the first emitted `next_*` block for loop reentry

No global stacks or label maps are used. These three variables are reset between stages or recursion levels.

#### Sequential Stages

In a linear sequence like:

```tacit
range 0 5
map { square }
filter { even? }
for-each { print }
```

Each stage emits its `init` and `next` blocks in order. The patch variables cleanly track the forward jumps from one block to the next. Since only one `init` and one `next` jump are pending at a time, the patch variables never overlap.

#### Forks and Nested Forks

Forks duplicate values, not control paths. Each branch is compiled recursively. The compiler uses a fresh set of patch variables per branch, and reconnects them using standard jump wiring.

Even multi-forks like:

```tacit
fork {
  { pass }
  { fork {
      { map { square } }
      { filter { even? } }
    } pack }
} zip
```

do not exceed the patch model because:

* Each branch is emitted in sequence
* Recursion isolates variable scopes
* Wiring is done after return via stack values

#### Restarts and Recursion

Restarts are compiled recursively. The inner block returns its `init`, `next`, and `loop_start` addresses on the stack. The outer stage pops and connects them.

Since restarts are emitted in their own scope, they do not interfere with outer patch variables. Even nested restarts (e.g., inside `map`) follow the same return protocol.

#### Example: Restart Inside Map

```tacit
map {
  restart {
    http-get $url
  }
}
```

* `map` compiles a nested `restart` block
* `restart` returns its addresses via the stack
* `map` stores them locally and jumps into the inner sequence
* All patching is handled with three variables per scope

#### No Stack Depth Tracking Needed

Since all jump addresses are values (not symbolic labels), and all nested blocks return addresses on the stack in a known order, the patch model remains flat and deterministic.

#### Conclusion

* Three variables are sufficient for all stages, including nesting and restarts
* Recursive codegen ensures no conflicts across scopes
* No dynamic tracking or global resolution is needed

This proves the patch model is minimal and complete for all Tacit sequences.

### 14. Codegen Examples

This section presents full codegen sketches of representative pipelines to demonstrate the correctness and completeness of the Tacit sequence system under the three-variable patch model.

---

#### Example 1: Simple Linear Sequence

```tacit
range 1 3
map { square }
for-each { print }
```

Codegen:

```tacit
main:
  jump init_range

init_range:
  1 -> $index
  3 -> $limit
  jump init_map

next_range:
  if $index > $limit:
    jump end
  $index -> $x
  $index += 1
  jump next_map

init_map:
  jump init_sink

next_map:
  $x * $x -> $y
  jump next_sink

init_sink:
  jump next_range

next_sink:
  print $y
  jump next_range

end:
  halt
```

---

#### Example 2: Restart with Unpack

```tacit
restart {
  fetch -> $items
}
unpack
for-each { print }
```

Codegen:

```tacit
main:
  jump init_restart

init_restart:
  fetch -> $items
  jump init_unpack

next_restart:
  jump next_unpack

init_unpack:
  $items -> $seq
  0 -> $i
  len $seq -> $n
  jump next_unpack

next_unpack:
  if $i >= $n:
    jump next_sink
  $seq[$i] -> $x
  $i += 1
  jump next_sink

init_sink:
  jump next_unpack

next_sink:
  print $x
  jump next_unpack

end:
  halt
```

---

#### Example 3: Pack

```tacit
range 1 7
pack 3
for-each { print }
```

Codegen:

```tacit
main:
  jump init_range

init_range:
  1 -> $index
  7 -> $limit
  jump init_pack

next_range:
  if $index > $limit:
    jump next_pack
  $index -> $x
  $index += 1
  jump next_pack

init_pack:
  [] -> $group
  3 -> $group_size
  jump next_range

next_pack:
  $group + $x -> $group
  len $group -> $count
  if $count < $group_size:
    jump next_range
  $group -> $batch
  [] -> $group
  jump next_sink

init_sink:
  jump next_range

next_sink:
  print $batch
  jump next_range

end:
  halt
```

---

#### Example 4: Restart Inside Map

```tacit
map {
  restart {
    http-get (url with page=$x)
  }
}
```

Codegen:

```tacit
next_map:
  $x -> $page
  jump init_restart

init_restart:
  $page -> $target
  jump next_restart

next_restart:
  http-get (url with page=$target) -> $result
  if $result == nil:
    jump init_restart
  $result -> $value
  jump next_sink

init_sink:
  jump next_map

next_sink:
  print $value
  jump next_map
```

Absolutely—here is the full codegen for the most complex example we constructed during this session, featuring nested forks, masking, zipping, and a limiting `take` stage.

---

#### Example 5: Complex Double Fork with Zip and Take

Tacit pipeline:

```tacit
range 0 5
fork {
  { }  ; A: pass-through
  {
    fork {
      { map { square } }        ; B1
      { filter { even? } }      ; B2
    }
    mask
  }
}
zip
take 3
for-each { print }
```

_Generated Code:_

```tacit
main:
  jump init_range

; === range ===
init_range:
  0 -> $index
  5 -> $limit
  jump init_fork_ab

next_range:
  if $index >= $limit:
    jump end
  $index -> $x
  $index += 1
  jump next_fork_ab

; === fork_ab ===
init_fork_ab:
  jump init_fork_b

next_fork_ab:
  $x -> $a         ; pass-through for A
  $x -> $b         ; input to nested fork
  jump next_fork_b

; === fork_b ===
init_fork_b:
  jump init_map_square

next_fork_b:
  $b -> $b1
  $b -> $b2
  jump next_map_square

; === map B1 ===
init_map_square:
  jump init_filter_even

next_map_square:
  $b1 * $b1 -> $b1
  jump next_filter_even

; === filter B2 ===
init_filter_even:
  jump init_mask

next_filter_even:
  $b2 % 2 -> $tmp
  if $tmp != 0:
    jump next_range    ; skip if odd
  jump next_mask

; === mask ===
init_mask:
  jump init_zip

next_mask:
  $b1 -> $b_masked
  jump next_zip

; === zip ===
init_zip:
  jump init_take

next_zip:
  jump next_take     ; $a and $b_masked are ready

; === take ===
init_take:
  3 -> $remaining
  jump init_sink

next_take:
  if $remaining == 0:
    jump end
  $remaining -= 1
  jump next_sink

; === sink ===
init_sink:
  jump next_range

next_sink:
  print $a $b_masked
  jump next_range

end:
  halt
```

---

This example exercises all aspects of the sequence model:

* _Nested forking_ with interleaved stage emission
* _Selective filtering and masking_ with conditional skipping
* _Forward-only control flow_
* _Use of `take` as a stateful limit gate_
* _Stream re-entry at `next_range` as loop start_

It confirms the robustness of the patch model, the consistency of structured stage emission, and the clarity of the data and control paths throughout even complex pipelines.

Here’s a clean section to insert into the spec—under a heading like _Codegen Emission Rules_—that formalizes this concept.

---

### 15. Codegen Emission Rules and Stage Emission Metadata

Each stage in Tacit defines its behavior during code generation in terms of whether it emits an `init_*` block and a `next_*` block. These declarations are used to streamline output and eliminate unnecessary code for stateless stages.

#### _Emitting Stage Definition_

For every stage type, the compiler attaches a metadata description that includes:

- `_init_required_`: whether the stage emits an `init_*` block
- `_next_required_`: whether the stage emits a `next_*` block

These properties determine what blocks are emitted and how the patching process links stages together.

#### _Patch Skipping and Jump Resolution_

When one stage completes its `init` and needs to emit `jump init_next_stage`, the compiler walks forward from the syntactic next stage until it finds one that has `init_required = true`. It emits a jump to that real block. This ensures that stateless stages do not produce empty blocks or redundant jumps.

The same logic applies when resolving `pending_init_patch`: the compiler skips forward past any stage with `init_required = false`.

This does not delay emission—it simply defers the jump target until the appropriate block is emitted, exactly as in normal patching.

#### _Emission Protocol_

For each stage:

- If `init_required` is `true`:
  - Emit a labeled `init_stage` block
  - Store `pending_init_patch` at the end of the previous stage
- If `next_required` is `true`:
  - Emit a labeled `next_stage` block
  - Store `pending_next_patch` at the end of the previous `next`
- If either is `false`, no label or block is emitted

Stages that do not emit a block are completely skipped during patching. Their presence in the source pipeline is preserved by their `next` logic alone.

#### _Examples_

```plaintext
Stage: map
  init_required: false
  next_required: true

Stage: for-each
  init_required: false
  next_required: true

Stage: pack
  init_required: true
  next_required: true
```

#### _Benefits_

- Eliminates unnecessary `init_*` blocks for stateless stages
- Reduces code size and jump overhead
- Maintains a consistent patching model
- Requires no changes to recursive codegen or block compilation

This metadata-driven model preserves the structure of the sequence while enabling efficient, precise emission tailored to the semantics of each stage.

### 16. Summary Commit

The compiled sequence system in Tacit is defined by a set of precise constraints and guarantees. It is a model for building streamed, restartable, and composable pipelines that compile into flat, linear code without control-flow ambiguity or runtime interpretation.

This system supports:

* _Single-pass, interleaved code generation_: Every stage is emitted inline, in the order it appears, without buffering or multi-phase compilation.
* _Structured `init`/`next` blocks_: Each stage declares its entry and per-item logic explicitly, forming the backbone of deterministic flow.
* _Minimal patching model_: Only three local patch variables (`pending_init_patch`, `pending_next_patch`, `loop_start`) are used per compilation scope. These handle all jump resolution.
* _Recursive code generation_: Blocks within stages (e.g. in `map`, `restart`) are compiled as independent pipelines. They emit their own structured blocks and return their jump addresses via the stack in a fixed order.
* _Forking, masking, zipping, batching_: Complex patterns like multi-branch forks, zip joins, filtered masks, and item grouping (`pack`) are naturally expressed using structured, non-recursive logic.
* _Structured restarts_: Retryable computations are encoded as restartable source stages with local logic for loop, reentry, and control.
* _Data clarity over stack tricks_: The stack is used only to move values between stages. All internal state within a stage is handled using local variables for legibility and robustness.
* _Composable transformations_: Blocks may contain full pipelines, including nested restarts, and are completely compatible with the surrounding sequence.
* _Full integrity under complexity_: From simple transforms to double forks with zipping and `take`, the system remains sound and reliable under the same minimal model.

This specification confirms that compiled sequences in Tacit are:

* _Deterministic_
* _Modular_
* _Restart-safe_
* _Recursively composable_
* _Free of dynamic dispatch or symbolic labels_

The resulting system is expressive, transparent, and formally constrained to produce readable, analyzable code from declarative pipelines.

