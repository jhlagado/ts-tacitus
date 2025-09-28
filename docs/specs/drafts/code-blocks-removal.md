# Brace Code Block Removal Summary

## Status
- **Completed:** Plan 32 replaced legacy `{ … }` quotations with immediate-word constructs.

## Outcome
- Tokenizer no longer emits dedicated block tokens; encountering `{` or `}` now raises a syntax error that directs authors to use immediate words closed by `;`.
- Parser helpers (`beginBlock`, `parseCurlyBlock`, `compileCodeBlock`) and the `insideCodeBlock` flag were deleted.
- VM runtime shed specialised support: `Op.BranchCall`, `skipBlockOp`, and `Op.ExitCode` are gone. Immediate control flow continues to rely on `Op.Branch` and `Op.IfFalseBranch`.
- Test suites relying on brace blocks were retired or converted to the new `… ;` form, and documentation/examples were rewritten accordingly.

## Migration Notes
- Use colon definitions or inline immediates (`if … else … ;`, `sort - ;`) instead of `{ … }` quotations.
- `eval` still executes tagged code references but now only encounters values emitted by the immediate infrastructure.
- The `Tag.CODE` meta bit remains reserved; it no longer distinguishes “brace blocks” at runtime.

## Follow-Up
- Track external libraries for lingering brace syntax and provide upgrade snippets where needed.
- Audit future metaprogramming features so they register immediates rather than reintroducing brace literals.
