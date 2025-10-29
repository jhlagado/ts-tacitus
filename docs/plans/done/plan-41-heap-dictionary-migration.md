# Plan 41: Heap-Backed Dictionary Migration (DONE)

Status: Done

Owner: VM/Language

Summary
- Replaced legacy dictionary-heap with a heap-backed dictionary built on the unified global heap. All symbol resolution now prefers the heap dictionary (dict-first) with a SymbolTable fallback.

What shipped
- Heap-backed dictionary entry format: `[prevRef, valueRef, name]` (LIST length 3)
- VM state: `vm.newDictHead` as the head of the dictionary chain
- Ops: `define`, `lookup`, `mark`, `forget`, `dump-dict` (debug)
- SymbolTable changes:
  - Mirroring of builtins and colon definitions into the heap dictionary
  - Dict-first lookup (default ON) with legacy fallback for parity
  - Checkpoint/restore includes `newDictHead` and `gp`
  - Globals now allocate a global DATA_REF and mirror into the heap dictionary (no legacy dict-head writes)
- Removed legacy components:
  - `src/core/dictionary-heap.ts` deleted and export removed
  - `vm.dictHead` removed; checkpoints cleaned up
- Debug builtins: `dict-first-on`, `dict-first-off`, `dump-dict`

Compatibility and behavior
- Parser/compiler behavior unchanged; symbol resolution returns the same tagged values
- Dict-first parity verified for builtins and colon definitions
- Global variable behavior and list semantics preserved

Tests (representative)
- Dictionary ops: define/lookup/shadowing, mark/forget
- Dict-first parity + toggle
- Dict checkpoint/revert
- Globals behavior: declare/read/assign/compound/exhaustion
- Direct addressing: builtins and code refs intact

Rationale and outcomes
- Decouples dictionary from legacy heap; consolidates storage on the unified global heap
- Cleaner SymbolTable as a facade; heap dictionary now authoritative storage
- Maintains semantics and performance acceptably; optional small caches can be added later if needed

Acceptance criteria (met)
- All relevant tests green after migration
- No change to language semantics; lookup parity ensured
- Legacy dictionary paths removed

Notes
- `dump-dict` aids diagnosing dictionary state at runtime
- Future: optional internal index to accelerate compile-time lookups if needed

