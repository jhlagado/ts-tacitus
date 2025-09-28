# Plan 32 — Remove Legacy Brace Blocks

## Status
- **State:** Completed
- **Owner:** Tacit core language initiative
- **Prerequisites:** Plan 31 (immediate conditionals) ✅

## Goals (Completed)
1. Eliminate `{ … }` block literals from the language surface and bytecode.
2. Simplify parser/tokenizer by removing block-specific token types and compilation paths.
3. Provide replacement metaprogramming patterns using immediate words instead of brace quotations.

## Outcome
- Tokenizer now flags `{`/`}` with a clear syntax error and no longer emits dedicated block tokens.
- Parser helpers (`beginBlock`, `parseCurlyBlock`, `compileCodeBlock`) and the `insideCodeBlock` bookkeeping flag were removed.
- VM runtime dropped `Op.BranchCall`, `skipBlockOp`, and `Op.ExitCode`; immediate control flow continues to use `Op.Branch` plus `Op.IfFalseBranch`.
- Legacy brace-focused tests and documentation were migrated to immediate-style syntax such as `if … else … ;` and `sort - ;`.

## Follow-Up
- Monitor ecosystem libraries for lingering brace syntax and update guidance as needed.
- Keep the `Tag.CODE` meta bit reserved for future metaprogramming features without reintroducing brace literals.
