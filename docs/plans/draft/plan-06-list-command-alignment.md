# Plan 06 — Align List Commands with lists.md Spec

Status: proposal
Owner: core
Scope: Rename/introduce list-related Tacit commands to match `docs/specs/lists.md` and remove non-conforming ones; adjust implementations and tests accordingly. No backward-compat aliases will be kept after migration.

## 1) Goals
- Make the exposed list commands and their stack effects comply with the names and ordering specified in `docs/specs/lists.md`.
- Favor list-first ordering. Specifically, cons/prepend uses `( list value — list' )`.
- Remove/avoid primitives discouraged by the spec (append as a primitive; special drop-list op).
- Keep mutation discussion high-level; do not expose specialized mutation commands in the public surface.

## 2) Spec reference (what the doc names)
- slots: `( list — n )` — O(1), header payload slot count
- elements: `( list — n )` — O(s), traversal by element
- slot: `( idx — addr )` — O(1), payload slot address (conceptual)
- element: `( idx — addr )` — O(s), element start address (conceptual)
- cons: `( list value — list' )` — O(1), prepend (list-first ordering)
- drop-head: `( list — list' )` — O(1), remove logical head element
- concat: `( listA listB — listC )` — O(n), flattening merge
- append: discouraged; not a primitive. Achievable via head-based idioms (swap + concat)
- drop: normal drop removes entire list (no special drop-list command)

Note: slot/element are address queries in the doc (conceptual). We may choose not to expose them as public commands.

## 3) Current command inventory (source)
From `src/ops/builtins-register.ts` (list-related):
- Literal/open/close: `(`, `)` → `openListOp`, `closeListOp`
- Header slot count: `.slot` → `listSlotOp`
- Skip list: `.skip` → `listSkipOp`
- Prepend: `prepend` → `listPrependOp` (current order: value list)
- Append: `append` → `listAppendOp`
- Random access: `get-at` → `listGetAtOp`, `set-at` → `listSetAtOp`

Other list-aware stack ops (in `builtins-stack.ts`):
- `drop` removes entire list if TOS is a list header
- `dup`, `swap`, `over`, `rot`, `revrot`, `nip`, `tuck` are list-aware (span-safe)

## 4) Gaps vs spec names
- `cons` not present (we have `prepend` but with value-first ordering).
- `concat` not present.
- `drop-head` not present.
- `slots` spec name vs `.slot` symbol name (dot-prefixed legacy).
- `elements` not present (optional).
- `slot`/`element` address query names differ vs current `get-at`/`set-at` (and semantics differ: get/set vs address query).
- `append` exists but is discouraged in the doc.
- `.skip` exists but doc says normal `drop` suffices.

## 5) Rename/add/remove plan
- Introduce `cons` command with list-first ordering: `( list value — list' )`.
  - Implement as a thin wrapper (or adjust `listPrependOp`) to enforce list-first.
  - Remove `prepend` once `cons` usage is green across tests.
- Introduce `concat` command: `( listA listB — listC )`.
  - Flat merge of list elements; if `listB` is not a list, behave like `cons`.
- Introduce `drop-head` command: `( list — list' )`.
  - Remove logical head in O(1) by using span of element 0.
- Expose `slots` command name for payload slot count.
  - Map existing implementation to a new symbol `slots`. Remove `.slot`.
- Do not expose `append` in docs; mark `append` as discouraged/deprecated. Keep the symbol temporarily for compatibility.
  - Remove `append` after `concat` idioms are green.
  - Remove `.skip`; normal `drop` suffices.
- Optional (phase 2): add `elements` if needed by callers/tests. Otherwise keep traversal internal.
- Optional (phase 2): do not expose `slot`/`element` address queries publicly; if needed for low-level tools, add them to an internal/advanced namespace.

## 6) Source tasks
- `src/ops/opcodes.ts`: add opcodes for `Cons`, `Concat`, `DropHead`, `Slots` (if new symbol distinct from `.slot`).
- `src/ops/builtins-list.ts`:
  - Implement `consOp` (list-first ordering). If reusing code, adjust `listPrependOp` or create new op.
  - Implement `concatOp` (O(n) flattening merge; fallback to `cons` if second arg is not a list).
  - Implement `dropHeadOp` using span of element 0.
  - Provide `slotsOp` aliasing the existing payload slot count implementation.
  - Remove `listAppendOp` and `listSkipOp` implementations once replaced; update call sites.
- `src/ops/builtins-register.ts`:
  - Register: `cons`, `concat`, `drop-head`, `slots`.
  - Remove legacy registrations: `.slot`, `prepend`, `.skip`, `append`.
  - Do not add new public commands for address queries.
- `src/lang/parser.ts`: no changes for literals; continue to use `(` `)`.
- `src/core/list.ts`: add helpers if needed for efficient concat/drop-head.

## 7) Tests
- New tests: `src/test/ops/lists/list-cons-concat.test.ts`
  - cons: list-first ordering, nested-compound behavior
  - drop-head: removes exactly head span, O(1)
  - concat: flattened merge, identity/associativity basics, fallback to cons when RHS is not a list
  - slots: returns header payload slot count
- Update/augment existing tests to prefer `cons`, `concat`, `drop-head`, `slots` over legacy `.slot`, `prepend`, `append`, `.skip`.
- Keep backward-compat tests for legacy names during deprecation period.

## 8) Removal policy (no legacy kept)
- Remove `prepend`, `append`, `.slot`, `.skip` from the public surface once replacement commands pass the full suite.
- Audit code/tests to eliminate their usage; update examples/docs accordingly.
- `get-at`, `set-at` considered internal/optional; evaluate separately for removal or internal-only retention.

## 9) Rollout & risk
- Risk: operand order change (list-first) can break existing code using `prepend`. Mitigation: keep `prepend` with legacy order as a separate symbol while introducing `cons` with list-first order.
- Risk: performance regressions from `concat`. Mitigation: keep O(1) cons-first building in hot paths; discourage `concat` in tight loops.

## 10) Inventory: list-related Tacit commands to examine
- `(`, `)` (list literals) — keep
- `.slot` (header slot count) — replace with `slots`; then remove
- `.skip` (drop entire list) — remove; normal `drop` suffices
- `prepend` (value-first prepend) — replace with `cons` (list-first); then remove
- `append` — replace with idioms; then remove
- `get-at`, `set-at` — optional/internal; not part of public doc; evaluate removal or rename only if required by callers
- (new) `cons`, `concat`, `drop-head`, `slots`

## 11) Acceptance criteria
- New commands exist and pass tests with list-first ordering.
- Legacy commands remain functional but are not referenced in the primary docs.
- Lists print and behave per spec; `drop` continues to remove entire list.
- No regressions in existing list tests.
