# Naming Guide

This guide captures the agreed conventions used across the codebase to improve clarity, predictability, and C-portability. It reflects Plan 19’s goals: stable facades, clear boundaries, and consistent naming.

## Modules and Imports

- Prefer facades: `@src/core` and `@src/strings` for cross-domain imports.
- Prefer domain barrels for ops: `@ops/lists`, `@ops/control`, `@ops/math`, etc.
- Avoid deep file imports across domains unless strictly necessary to prevent cycles.

## Functions and Helpers

- Ops: imperative Tacit word with `Op` suffix, e.g. `fetchOp`, `printOp`, `selectOp`.
- Helpers: descriptive nouns/phrases, e.g. `getListBounds`, `computeHeaderAddr`.
- Tagged/refs helpers: clear prefixes: `is<Tag>`, `make<Tag>` (or `create<Tag>`), `tagOf`, `valueOf`.
- Formatting vs printing: keep formatting pure and side-effect free, I/O in print layer.

## Files and Structure

- `core/format-utils.ts`: pure, reusable formatting helpers.
- `ops/print/print-ops.ts`: printing and console I/O; delegates to `format-utils`.
- `core/errors.ts`: common error types and message helpers; keep hot paths lean.
- Keep hot-path utilities simple (loops over abstractions) to preserve portability.

## Error Messages

- Include operation name and required stack depth when applicable.
- Provide segment/tag context when helpful.
- Favor concise, consistent wording; avoid leaking internals.

## Style Notes

- Use descriptive names; avoid single-letter identifiers outside tight loops.
- Keep public surfaces minimal; avoid widening facades without need.
- Prefer additive, incremental changes with test verification at each step.

## Registers and Units

- Prefer `SP` and `RSP` (cell-indexed) in code and docs. `RP` refers specifically to the legacy byte-based accessor, which remains available for compatibility.
- `BP` remains byte-based (frame layout and slot addressing). When converting `BP`→`RSP`, validate alignment and bounds before dividing by cell size.

## Examples

- `formatList(vm, header)` — pure formatting for lists.
- `printOp(vm)` — side-effectful printing; uses `formatValue` from `format-utils`.
- `isRef(tval)`, `createStackRef(idx)`, `resolveReference(vm, ref)` — reference utilities with explicit prefixes.
