Errors and Failures

Scope: minimal, predictable behavior for reads vs writes without stack noise.

Principles
- Stack safety throws: over/underflow on data/return stacks always raise errors.
- Preconditions throw: malformed tags, invalid references, or required inputs missing.
- Reads soft‑fail: non‑mutating queries return NIL on invalid target or not‑found.
- Writes throw: mutations fail fast with clear messages; no return values.

Operations
- Address queries: `select`, `slot`, `elem`, `find` → ref|NIL (no throws for not‑found).
- Value queries: `retrieve` → value|NIL; `load` → identity/materialize; `fetch` → throws if not a reference.
- List queries: `length`, `size` → count; NIL if target is not a list.
- Mutations: `update`, `store`, `initvar`, in‑place compound mutation → throw on failure; no outputs.

Canonical Errors (messages)
- Bad address: "store expects reference address (STACK_REF, RSTACK_REF, or GLOBAL_REF)".
- Type mismatch: "Cannot assign simple to compound or compound to simple".
- Incompatible compound: "Incompatible compound assignment: slot count or type mismatch".
- Strict read: "fetch expects reference address (STACK_REF, RSTACK_REF, or GLOBAL_REF)".

Notes
- Reads do not encode errors as numbers; NIL indicates invalid/missing data.
- Writes never materialize destinations; mutate in place or fail.

