# Plan 43: Direct Registers (remove uppercase shims)

Status: Draft. Priority: High. Scope: Remove legacy uppercase depth accessors (SP/RSP/BP/GP) and migrate code/tests to use lowercase absolute registers (sp/rsp/bp/gp) with absolute addressing.

Context

- Plan 42 unified runtime to absolute-only addressing on SEG_DATA for lists/refs/heap/capsules. Lowercase register fields exist and are authoritative.
- Uppercase accessors remain as depth-oriented shims (e.g., SP returns depth, not absolute cell index). Many tests still assert via uppercase.

Goals

- Use lowercase registers everywhere in runtime and ops: `sp`, `rsp`, `bp`, `gp` (absolute cell indices).
- Remove uppercase accessors (`SP`, `RSP`, `BP`, `GP`) from `VM`.
- Ensure tests and docs reflect absolute-only model without depth-based accessors.

Non-Goals

- Change semantics of existing ops beyond addressing form.
- Introduce new public helpers unless strictly necessary for clarity.

Phases

1) Inventory and classification (read-only)
   - Locate all uses of `vm.SP`, `vm.RSP`, `vm.BP`, `vm.GP` in src and tests.
   - Classify per site:
     - A: Safe 1:1 swap (e.g., `vm.GP` → `vm.gp` when representing a bump count measured from zero).
     - B: Absolute-friendly (ops already using absolute addresses), convert arithmetic to `vm.sp`/`vm.rsp` and remove segment-base math.
     - C: Depth-dependent logic (comparisons to constants, UI/prints, stack utils) — switch to `vm.ensureStackSize` and/or compute depth as `vm.sp - STACK_BASE/CELL_SIZE`.

2) Runtime migration (src)
   - Replace A/B sites first; keep behavior identical.
   - Update `core` helpers to avoid calling uppercase accessors internally (use private fields or lowercase regs).
   - Keep uppercase shims temporarily exported to avoid breaking tests mid-migration.

3) Tests migration
   - Replace `vm.SP`/`vm.RSP`/`vm.BP`/`vm.GP` assertions with:
     - Depth: `vm.getStackData().length` (preferred) or `vm.sp - STACK_BASE/CELL_SIZE`.
     - Return depth: `vm.rsp - RSTACK_BASE/CELL_SIZE` where depth is explicitly asserted.
     - Global: `vm.gp` for heap cell count.

4) Removal
   - Delete uppercase getters/setters from `VM` once no references remain.
   - Update docs to remove mentions of uppercase accessors.

Acceptance criteria

- All src modules refer only to lowercase registers; stack and return-stack I/O use absolute addressing consistently.
- All tests pass without uppercase accessors available in `VM`.
- Coverage remains at or above current thresholds.

Risk control

- Migrate in small batches, run full test suite after each batch.
- For depth-sensitive paths, prefer `vm.ensureStackSize` to reduce dependence on register reading.

Current progress (2025-10-25)

- Done: Lists and heap ops migrated to lowercase/absolute in several modules (`lists/build-ops`, `lists/structure-ops`, `core/list.ts`, `core/global-heap.ts`).
- Todo: Stack ops (`ops/stack/**`), some core ops (`ops/core/**`), print ops, and test assertions referencing uppercase.
- Next: Design a minimal test helper or adopt `vm.getStackData().length` for depth assertions; then sweep tests and finally remove uppercase shims from `VM`.
