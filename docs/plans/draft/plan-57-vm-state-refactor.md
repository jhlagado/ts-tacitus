# Plan 57: VM State Refactor (Execution Registers at Root)

## Goals
- Keep execution registers at the VM root, camelCase (`ip`, `sp`, `rsp`, `bp`, `running`, `err`, `inFinally`, `debug`, `listDepth`, `gp`).
- Rename `IP` → `ip` consistently across code/tests.
- Avoid getters/setters; direct field access with TypeScript interfaces.
- Keep `currentTokenizer` at root (no parser group unless more fields emerge).
- Optionally group compile-time fields, but focus on clarity without churn.

## Tasks (Sequenced)
1) **Interface update**
   - In `src/core/vm.ts`, rename `IP` to `ip`; ensure exec fields stay at root.
   - Add `err`, `inFinally` if not already present; keep `gp` at root.
2) **Bulk rename**
   - Replace all `vm.IP` with `vm.ip` across src/tests.
   - Update helper signatures in `src/core/vm.ts` (read8, readOp, etc.) to use `ip`.
3) **Type cleanup**
   - Ensure VM interface reflects exec fields at root; no getters/setters introduced.
   - Leave `currentTokenizer` at root; no parse group for now.
   - Optionally group compile-time fields (`compiler`, `localCount`, `defBranchPos`, `defCheckpoint`, `defEntryCell`) under a `compile` sub-object only if it reduces confusion; otherwise keep flat.
4) **Consistency sweep**
   - Verify no leftover uppercase `IP`; check for mixed casing in registers.
   - Ensure new fields (`err`, `inFinally`) are initialized/reset in `createVM` and any VM cache helper.
5) **Testing**
   - Run full test suite after renames to catch any missed references.

## Notes
- Execution registers remain at root as requested; `gp` stays with exec.
- Direct access only; no getters/setters.
- If more parser state is added later, consider a `parse` sub-object; currently `currentTokenizer` stays flat.
