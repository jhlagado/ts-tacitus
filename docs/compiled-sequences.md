# TACIT Pipeline Code Generation Model – Revised Reference (Restart-Aware)

This document outlines the code generation model used in the _Tacit language_ to compile declarative data pipelines into fully flattened, lazy, and restartable programs. The compiler uses a _single-pass, forward-only_ strategy and requires no labels, no closures, and no global variable declarations. Every sequence stage is self-contained and restart-aware.

---

## OVERVIEW

Tacit pipelines are declarative sequences of data transformations, like:

```
range
map square
filter isEven
take 5
for-each print
```

Each pipeline compiles into a _single flat function_, where execution is lazy and driven by the sink. Compilation occurs in _source-to-sink order_, while runtime pulls data _sink-to-source_.

---

## COMPILATION MODEL

Tacit uses a _single-pass code generator_, powered by:

* A _stage stack_ – tracks addresses of previous stages
* A _patch stack_ – for forward jumps (typically one: jump to sink)
* Direct _address wiring_ using numeric addresses, no labels
* _Immediate emission_ – no deferred blocks or AST
* Each stage has _two entry points_: one for `restart`, one for `next`

---

## STAGE ENTRY POINTS

Each compiled stage has _two known jump targets_:

### 1. `init` (restart)

* Initializes that stage's state variables
* Jumps into the next-entry block

```pseudo
addr_restart_stage:
  counter = 0
  max = 10
  jump addr_next_stage
```

### 2. `next` (pull)

* Returns the next value
* If exhausted, returns `null`

```pseudo
addr_next_stage:
  if counter >= max: return null
  val = counter
  counter += 1
  return val
```

---

## HOW EXECUTION WORKS

* The _sink_ (`for-each`, etc.) drives execution by calling the `next` entry of its source
* To _restart_ a pipeline or sub-sequence, just call the `restart` entry of the first stage
* No additional flags or runtime management is required

---

## COMPILER STACKS

### Stage Stack

Used to wire each stage to its predecessor:

* At each stage: pop the previous stage address
* Emit a `call` to that address
* Push the current stage's own `next` and `restart` addresses

### Patch Stack

Used for forward jump to the sink:

* Emit `jump ???` at the top
* Push patch address onto stack
* At the end, patch with `addr_foreach`

---

## LOCAL STATE AND SCOPE

State variables are defined _within the stage that uses them_. No global variable table is maintained.

State is always initialized at the `restart` entry point.

---

## PIPELINE STRUCTURE

Each stage compiles to:

```pseudo
addr_restart_foo:
  ... initialize vars ...
  jump addr_next_foo

addr_next_foo:
  call addr_next_bar
  ... transform ...
  return result
```

---

## FULL PIPELINE EXAMPLE

### Pipeline

```
range
map square
take 5
for-each print
```

### Output

```pseudo
main:
  jump ???                ; patched later

addr_restart_range:
  index = 0
  limit = 20
  jump addr_next_range

addr_next_range:
  if index >= limit: return null
  val = index
  index += 1
  return val

addr_restart_map:
  jump addr_next_map

addr_next_map:
  val = call addr_next_range
  if val == null: return null
  return val * val

addr_restart_take:
  count = 0
  maxcount = 5
  jump addr_next_take

addr_next_take:
  if count >= maxcount: return null
  val = call addr_next_map
  if val == null: return null
  count += 1
  return val

addr_foreach:
  loop:
    val = call addr_next_take
    if val == null: return
    print(val)
    goto loop
```

---

## RESTARTING A PIPELINE

To restart the pipeline, simply:

```pseudo
call addr_restart_range
call addr_restart_map
call addr_restart_take
call addr_foreach
```

Each stage reinitializes itself and resumes from the top.

---

## FORKED PIPELINES

In a fork, you duplicate a stage’s `next` and/or `restart` addresses:

```pseudo
stack.push(addr_next_range)
stack.push(addr_next_range)
stack.push(addr_restart_range)  ; if both branches must restart
```

Each consumer then calls independently.

---

## RETRYABLE STAGES

You can define a `retry` stage that calls upstream until it gets a non-null result:

```pseudo
addr_restart_retry:
  jump addr_next_retry

addr_next_retry:
  loop:
    val = call addr_next_map
    if val == null: goto loop
    return val
```

---

## NESTED + ZIP EXAMPLE

### Pipeline

```
zip(range1, range2)
map add
for-each
```

### Output

```pseudo
addr_restart_range1:
  i1 = 0
  jump addr_next_range1

addr_next_range1:
  if i1 >= 10: return null
  val = i1
  i1 += 1
  return val

addr_restart_range2:
  i2 = 0
  jump addr_next_range2

addr_next_range2:
  if i2 >= 10: return null
  val = i2
  i2 += 1
  return val

addr_restart_zip:
  jump addr_next_zip

addr_next_zip:
  a = call addr_next_range1
  b = call addr_next_range2
  if a == null or b == null: return null
  return (a, b)

addr_restart_map:
  jump addr_next_map

addr_next_map:
  pair = call addr_next_zip
  if pair == null: return null
  return pair.a + pair.b

addr_foreach:
  loop:
    val = call addr_next_map
    if val == null: return
    print(val)
    goto loop
```

---

## WHY THIS WORKS

This model is:

* _Fully lazy_
* _Fully restartable_
* _Single-pass compilable_
* _Readable and maintainable_
* _Zero closures_
* _Zero heap allocation_
* _Flat and inlined_
* _Compatible with cooperative multitasking or `yield` in sinks only_

---

## OPTIONAL EXTENSIONS

* Add support for _persistent state_ using data cells outside the stack
* Inline simple stages for _performance_
* Add _stage flags_ (optional) for runtime introspection

---

## CONCLUSION

This model gives Tacit a clean, powerful, and efficient foundation for compiling declarative pipelines. With restartable, localized, flat stages and no global state, it supports everything from streams to structured control without abandoning the minimalism and composability that Tacit is built around.

