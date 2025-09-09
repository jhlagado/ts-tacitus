# Naming and Public API Style

This document codifies conventions for naming public functions and shaping small, predictable APIs. It complements `docs/naming-guide.md` with concrete rules and examples, and captures recent decisions to simplify terms (avoid “compound”) and standardize verbs (load/fetch/resolve).

## Goals
- Short, descriptive names; avoid sentence-like camelCase.
- Consistent verbs across the stack (fetch/load/resolve).
- Reduce use of the word “compound” in public APIs; prefer domain terms (list, maplist).
- Keep public surfaces stable; evolve via aliases + deprecation windows.

## Function Naming Rules
- Public ops: imperative verb + `Op` suffix (e.g., `fetchOp`, `printOp`).
- Public helpers: 1–2 word camelCase names. Avoid names that read like sentences.
  - Good: `getListBounds`, `getListElemAddr`, `computeHeaderAddr`.
  - Avoid: `getListHeaderAndBase` (prefer `getListBounds`).
- Prefer domain terms over generic “compound”.
  - `isCompoundData` → `isList` (or type-specific check).
  - `isCompatibleCompound` → `isCompatible` (list-only today), or `isListCompatible` if disambiguation helps.
  - `mutateCompoundInPlace` → `updateListInPlace` (keep “InPlace” to signal mutation).
- Use specific, consistent verbs:
  - resolve: convert a reference to `{ segment, address }`; no memory read.
  - fetch/read: dereference an address/reference and read a value (no materialization unless specified by the op).
  - load/materialize: copy a structure from a segment into the data stack as payload+header.

## Parser Emitters
- Use `emit*` for codegen shortcuts:
  - `emitNumber`, `emitString`, `emitWord`, `emitAtSymbol`, `emitRefSigil`, `emitVarDecl`, `emitAssignment`.
- Handlers:
  - `handleSpecial` for special tokens.
  - `beginBlock` for standalone curly-blocks.

## Examples (Accepted Aliases)
- Local vars transfer
  - `transferCompoundToReturnStack` → `rpushList`.
  - `materializeCompoundFromReturnStack` → `loadListFromReturn`.
  - `isCompoundData` → use `isList`.
  - `isCompatibleCompound` → `isCompatible`.
  - `mutateCompoundInPlace` → `updateListInPlace`.
- List helpers
  - `getListElementAddress` → `getListElemAddr`.
  - `getListHeaderAndBase` → `getListBounds`.
- Formatting
  - `formatListByConsumingStack` → `formatList`.
- Interpreter / Builtins
  - `callTacitFunction` → `callTacit`.
  - `dumpStackFrameOp` → `dumpFrameOp`.

## Resolve vs Fetch vs Load
- `resolveReference(vm, ref)` returns `{ segment, address }` for a polymorphic reference (no read).
- `fetchOp`/`readReference` read a value at an address/ref. If the value is a list header, `fetchOp` materializes payload+header.
- `loadOp` performs value-by-default deref with a bounded, at-most-one extra deref and materialization for lists.
- Naming guidance:
  - Keep “resolve” for address computation.
  - Use “fetch”/“read” for direct reads.
  - Use “load”/“materialize” where the stack result is a full list on the data stack.

## Deprecation Process
- Introduce new names as aliases (re-exports) first.
- Update internal imports to use the new names.
- Remove the old names after a deprecation window (or when major versioning allows).

## Do / Don’t
- Do: `getListBounds`, `updateListInPlace`, `isCompatible`.
- Don’t: `getListHeaderAndBase`, `mutateCompoundInPlace`, `isCompoundData`.
- Do: `emitNumber`, `emitString`, `emitWord` for parser.
- Don’t: `compileNumberLiteral`, `compileStringLiteral`, `processWordToken` in external-facing docs.

## Scope
- Applies to exported/public functions in `src/core`, `src/lang`, and `src/ops`.
- Test helpers can be more verbose if needed for clarity.

