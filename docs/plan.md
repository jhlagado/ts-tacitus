# Tacit Language Update Plan: Document Revisions for June 2025

## 1. Tuples and Capsules

- The `span` tag is renamed to `tuple`. All tuples are length-prefixed sequences of tagged values. This replaces previous terminology and unifies the representation.
- Tuples may nest recursively, and the length field at the head is sufficient to identify the structure.
- Capsules remain a subtype of tuples: the last slot is a function reference (`apply`, `next`, or another conventional word).
- Self-modifying capsules use local variable slots to mutate internal fields, and will be described in the capsules section of the combinators document.

## 2. Buffers

- Buffers begin with a 32-bit metadata header.

  - The first word indicates the number of metadata slots, not the total data length.
  - The data length (or item count) should be stored explicitly in one of those slots, typically the first.

- This allows uniform parsing and interpretation across buffer types (e.g. stacks, tables, views).
- The buffer tag will distinguish it from tuples, and segment bits in the tag identify origin (stack, code, string, global).

## 3. Tagged Values

- Update the tag space:

  - Introduce segment identification bits (e.g. 2 bits) for stack/global distinction.
  - Explicit tag kinds: `int`, `float`, `tuple`, `buffer`, `ref`, `string`, `code`.

- Rules for runtime validation:

  - Stack references must include a valid BP (base pointer) check to ensure scope correctness.
  - Tuples and buffers are self-identifying and include headers.

## 4. Sequence Monad Model

- Introduce `sequence` (or `seq`) as the canonical starting point for a pipeline.
- Each stage (`range`, `map`, `filter`, etc.) receives a monad and returns an extended monad, embedding upstream context.
- Sinks (e.g. `foreach`) act as final combinators, invoking the monad chain.
- Execution is lazy, initiated by the sink, and restarts the chain each tick.
- To prevent scope leakage:

  - The sequence monad captures the BP of its originating function.
  - Any attempt to run the monad from a mismatched BP fails.
  - Sequences cannot be returned or stored in global/local variables outside their defining scope.

## 5. Enforcement

- Sequences, tuples, and buffers may only be run or used when validated against their tag and segment constraints.
- Local-only objects (e.g. stack-allocated buffers or sequence chains) are explicitly checked at runtime.
