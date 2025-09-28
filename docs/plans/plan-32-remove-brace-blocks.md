# Plan 32 — Remove Legacy Brace Blocks

## Status
- **State:** Draft
- **Owner:** Tacit core language initiative
- **Prerequisites:** Plan 31 (immediate conditionals) complete; documentation refreshed for immediate control flow.

## Goals
1. Eliminate `{ … }` block literals from the Tacit language surface and bytecode.
2. Simplify parser/tokenizer by removing block-specific token types and compilation paths.
3. Provide alternative meta constructs (immediate words or other forms) for existing comparator/quotation use cases.

## Non-Goals
- Introducing advanced macro systems beyond what is needed to replace existing brace use.
- Revisiting unrelated VM tags or stack layouts (handled in separate plans if needed).

## Deliverables
- Parser/tokenizer change proposal (RFC) describing new constructs that replace braces.
- Implementation patches removing `TokenType.BLOCK_START/BLOCK_END`, `beginBlock/parseCurlyBlock/compileCodeBlock`, and the `Op.ExitCode` opcode.
- Migration of all remaining runtime tests and docs away from brace syntax.
- Release notes outlining breaking changes and upgrade guide.

## Work Breakdown
1. **Analysis (Documentation & RFC)**
   - Catalogue remaining runtime/doc/test usages (comparators, capsules draft, etc.).
   - Publish an RFC proposing replacement constructs (e.g., immediate comparators, named quotations).
2. **Parser & Tokenizer Cleanup**
   - Remove `{`/`}` as special token types.
   - Delete `beginBlock`, `parseCurlyBlock`, `compileCodeBlock`, and related VM helpers.
   - Ensure legacy code emits clear errors recommending the new syntax.
3. **VM & Opcode Simplification**
   - Remove `ExitCode` opcode and associated runtime handling.
   - Verify `eval` semantics still cover builtins and code refs.
4. **Library & Test Migration**
   - Update remaining helper utilities (e.g., comparator generators) to use new syntax.
   - Refactor tests that still rely on braces (standalone blocks suite, tokenizer fixtures).
5. **Docs & Release Notes**
   - Replace brace-based examples in specs and learn docs with the new constructs.
   - Add a migration guide for library authors, quoting the new syntax.

## Dependencies
- Final confirmation that all control flow is covered by immediate words (Plan 31 ✅).
- Agreement on replacement syntax (delivered via RFC during Step 1).

## Open Questions
- What is the ergonomic replacement for inline comparators? (e.g., dedicated `cmp{}` words, immediate `comparator … ;` forms.)
- Do we still need a mechanism for user-defined quotations or can immediate words cover all use cases?
- Should capsules/method tables proceed before or after brace removal?

## Timeline (Tentative)
- Week 1–2: Analysis + RFC.
- Week 3–4: Parser/tokenizer removal and VM cleanup.
- Week 5: Test suite migration.
- Week 6: Documentation sweep + release notes.
