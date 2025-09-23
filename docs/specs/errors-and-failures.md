Errors and Failures

Scope: minimal, predictable behavior for reads vs writes without stack noise. Unhandled errors now surface with a deterministic stacktrace.

Principles
- Stack safety throws: over/underflow on data/return stacks always raise errors.
- Preconditions throw: malformed tags, invalid references, or required inputs missing.
- Reads soft-fail: non-mutating queries return NIL on invalid target or not-found.
- Writes throw: mutations fail fast with clear messages; no return values.

Operations
- Bracket read: `expr[ … ]` → value|NIL (no throws for not-found).
- Address queries: `select`, `slot`, `elem`, `find` → ref|NIL.
- Value by default: `load` → identity/materialize; strict address read: `fetch` → throws if not a reference.
- List queries: `length`, `size` → count; NIL if target is not a list.
- Mutations: `value -> x[ … ]` and low-level `store`/compound mutation → throw on failure; no outputs.

Canonical errors (messages)
- Bad address: "store expects reference address (STACK_REF, RSTACK_REF, or GLOBAL_REF)".
- Type mismatch: "Cannot assign simple to compound or compound to simple".
- Incompatible compound: "Incompatible compound assignment: slot count or type mismatch".
- Strict read: "fetch expects reference address (STACK_REF, RSTACK_REF, or GLOBAL_REF)".

Stacktrace emission (normative)
- Any error that propagates to the host without being caught triggers stacktrace capture before raising a `TacitRuntimeError` (or equivalent host error wrapper).
- The runtime walks return-stack frames starting at the current `BP`, validating `BP ≤ RSP`. Each frame yields the saved return address; the runtime resolves that address back to the nearest function start in the CODE segment.
- Frames are reported from innermost to outermost, capped at eight entries to avoid runaway traces in corrupted stacks. If frame data is invalid, the walker stops early after reporting what was successfully recovered.

Frame identification
- The compiler records every function/quotation start address. At error time the runtime finds the entry whose start IP is the greatest value ≤ the captured return IP. That entry provides the function name (or builtin label) and its start address.
- The displayed offset is `returnIP - startIP`, expressed as a signed byte offset (e.g., `add : +12`). This mirrors bytecode distance rather than source characters, acknowledging hidden lowering opcodes.
- When no metadata matches a captured IP, the runtime falls back to a hexadecimal address label (e.g., `@0x1234 : +0`).

Output format (host/CLI example)
```
Error: broadcast type mismatch
  at add : +12
  at map-list : +40
```
The first line is the canonical error message. Each subsequent line shows `function-name : offset`, with the innermost frame first.

Notes
- Reads do not encode errors as numbers; NIL indicates invalid/missing data.
- Writes never materialize destinations; mutate in place or fail. Destinations must be addresses; bracket writes restrict destination to locals to guarantee write-through.
- Catching/rethrowing user-level errors is future work; current behavior always surfaces the stacktrace when the error escapes the Tacit VM.
