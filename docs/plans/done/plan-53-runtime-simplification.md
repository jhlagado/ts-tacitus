# Plan 53 – Runtime Simplification & Audit

## Goal

Systematically simplify the Tacit runtime (core, lang, ops, meta) by removing redundant helpers, inlining trivial single-use functions, and reducing file count where practical—without changing semantics. The intent is to make the codebase easier to reason about end-to-end.

## Current Pain Points

- Numerous one-line wrappers and bridge helpers obscure control flow.
- Some modules exist solely to export a handful of verbs.
- Cross-layer dependencies have previously crept in; we must verify the current split still makes sense after consolidation.

## Concrete Action Plan

### Stage 1 – Parser / Meta Consolidation

1. **`src/lang/parser.ts`**
   - Inline `handleSpecial` logic for `'(' / ')' / '['` into `processToken` to remove single-use helpers where possible.
   - Remove `parseApostropheString` helper by inlining the string literal logic directly in the `'` branch (still keeping comments for clarity).
2. **`src/lang/meta/executor.ts`**
   - Evaluate whether `runImmediateCode`’s VM-state save/restore wrapper can live inside `parser.ts` or be folded into a shared utility in `core/vm.ts`.
   - If `semicolonImmediateOp` only forwards to `evalOp`, inline the call in parser immediate dispatch.
3. **`src/lang/meta/case.ts` + `src/lang/meta/match-with.ts`**
   - Merge into a single `case-match.ts` module; both exports are tightly coupled and only used together.
4. **`src/lang/meta/variables.ts`**
   - Inline `compilePathList` into `assignImmediateOp` / `incrementImmediateOp` (only two call sites) if it keeps the logic readable.

### Stage 2 – Core Helpers

1. **`src/core/vm.ts`**
   - Audit one-liners like `peek`, `depth`, `rdepth`, `rpush`, etc. Identify any that are simply “read cell at SP-1” wrappers used at a single call site and inline them.
   - Consider moving `emitOpcode`, `emitUint16`, etc., closer to the compiler module to avoid cross-file indirection if they only wrap `compilerCompile*`.
2. **`src/core/dictionary.ts`**
   - The exported `lookupOp`, `defineOp`, etc., may only wrap existing `dictionary` functions for builtins table. If so, inline the registration-side wrappers and keep only the actual dictionary helpers.

### Stage 3 – Ops Simplification

1. **`src/ops/builtins.ts`**
   - Remove unused `TacitWord` table entries (Nop, removed opcodes); collapse the `OPCODE_TO_VERB` table generation into a direct object literal with only active entries.
2. **`src/ops/builtins-register.ts`**
   - Inline alias registrations (e.g., `push/pop/shift/unshift`) into the sections where the primary op is defined to reduce the long list of `reg` calls.
3. **`src/ops/lists/**`\*\*
   - Combine `structure-ops.ts`, `build-ops.ts`, and `query-ops.ts` if they only export a handful of functions each; or move the select few functions into `lists/index.ts`.

### Stage 4 – Tokenizer / Compiler cleanup

1. **`src/lang/tokenizer.ts`**
   - Inline the `skipWhitespace` and `skipComment` helpers into `nextToken` if they are single-use.
2. **`src/lang/compiler.ts`**
   - Collapse the `compilerCompile*` one-line wrappers (`compilerCompileOpcode`, `compilerCompileFloat32`, etc.) into direct `vm.memory.write` calls in parser to avoid extra indirection.

### Stage 5 – Dependency Verification

1. **Check Imports**
   - For each module touched, ensure `core` never imports from `lang`, `ops` only imports from `core`, and `lang` can import from both.
2. **Dead File Removal**
   - After consolidation, delete any emptied files (`case.ts`, `match-with.ts`, etc.) and update import paths accordingly.

## QA Strategy

- **Unit Coverage:** Run the full Jest suite (`yarn test`) after every consolidation batch; rely on the existing wide coverage across core/lang/ops.
- **Static Analysis:** Run `yarn lint` to catch dependency rule violations or unused imports created by inlining.
- **Manual Spot Checks:** For any moved functions (especially in parser/meta), manually review the disassembly to ensure no accidental behavior changes (e.g., immediates still execute, compiler state resets properly).
- **Regression Guardrails:** If any helper removal touches VM state (stack, compiler, tokenizer), add temporary assertions while refactoring to confirm invariants before removing them.

## Next Steps (Awaiting Approval)

1. Review this plan and confirm scope/priorities (e.g., focus on parser/meta first, or sweep ops/math, etc.).
2. Once approved, proceed with Stage 1 (inventory + inline candidate list) and report findings before touching code.
