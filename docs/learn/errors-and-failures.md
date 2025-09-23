Errors and Failures

Tacit keeps runtime errors predictable: reads soft-fail with `NIL`, while illegal writes and stack corruption throw. Unhandled errors now ship with a concise stacktrace so you see where things went wrong.

Principles
- Stack safety throws: data/return-stack overflows or underflows always raise errors.
- Preconditions throw: malformed tags, invalid references, or missing required inputs abort execution.
- Reads soft-fail: non-mutating queries yield `NIL` when the target is missing or incompatible.
- Writes throw: assignment and mutation either succeed in place or raise an error; no partial state.

Operations quick reference
- Bracket read: `expr[ … ]` → value or `NIL` (no throw on not-found).
- Address queries: `select`, `slot`, `elem`, `find` → ref or `NIL`.
- Value-by-default: `load` → identity/materialize. Strict read: `fetch` → throws if input is not a reference.
- List queries: `length`, `size` → counts; `NIL` if input is not a list.
- Mutations: `value -> x[ … ]`, `store`, compound writes → throw on failure; no return values.

Canonical error messages
- "store expects reference address (STACK_REF, RSTACK_REF, or GLOBAL_REF)"
- "Cannot assign simple to compound or compound to simple"
- "Incompatible compound assignment: slot count or type mismatch"
- "fetch expects reference address (STACK_REF, RSTACK_REF, or GLOBAL_REF)"

Stacktraces for unhandled errors
- When an error is about to escape to the host, the VM walks the call stack (up to eight frames) and resolves each return address to the closest function start recorded by the compiler.
- Frames are rendered from innermost to outermost in the form `function-name : +offset`, where `offset` is the byte distance from the function’s entry point to the failing location.
- Missing metadata falls back to a raw address label like `@0x1234 : +0`.
- Example host output:
  ```
  Error: broadcast type mismatch
    at add : +12
    at map-list : +40
  ```

Notes
- Reads never encode errors as numeric sentinels; `NIL` signals the soft-failure path.
- Destinations for writes must be references; bracket writes remain locals-only to enforce write-through semantics.
- Error catching/rethrowing is not yet exposed; every escaping error includes the stacktrace described above.
