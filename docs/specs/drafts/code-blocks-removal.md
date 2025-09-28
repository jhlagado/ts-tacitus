# Brace Code Block Removal Brief

## Context
Legacy Tacit syntax treated `{ … }` as block literals that compiled to quotations and executed via `eval` (using `Op.ExitCode`). With the adoption of immediate words (`:` definitions, `if/else`), these block constructs are redundant and create parser/VM complexity.

## Objectives
- Retire `{ … }` tokens and the associated compile-time pathways (`TokenType.BLOCK_START/BLOCK_END`, `beginBlock`, `parseCurlyBlock`, `compileCodeBlock`).
- Remove runtime support for `Op.ExitCode` and the old distinction between “code blocks” and “functions” in code references; the meta bit in `Tag.CODE` remains reserved for future use but no longer changes runtime behaviour.
- Provide alternative patterns (e.g., immediate comparators, named definitions) for scenarios currently illustrated with braces.

## Affected Areas
- **Parser/Tokenizer:** block tokens, code-block compilation helpers, uppercase `IF` combinator fallback.
- **VM Runtime:** `ExitCode` verb, meta-bit handling for lexical quotations, brace-specific tests.
- **Documentation:** specs and learn guides referencing `{ … }`, comparator examples, capsules drafts.
- **Test Suites:** `standalone-blocks`, tokenizer fixtures, comparator helpers in `access-test-utils`.

## Migration Strategy
1. Introduce replacement syntax (immediate comparator words, named helper definitions) and update documentation.
2. Deprecate brace usage by flagging it during parsing (warning/error) while replacements exist.
3. Remove parser/runtime support once codebase, docs, and tests no longer depend on braces.
4. Communicate change in release notes with migration examples (`sort - ;`, `1 if … ;`).

## Risks & Mitigations
- **Third-party code using braces:** Provide a deprecation window and automated migration tips.
- **Comparator ergonomics:** Ensure new syntax remains concise, possibly via helper words/macros.
- **Capsules/method tables drafts:** Coordinate with capsule design to avoid reintroducing braces.

## Next Steps
- Execute Plan 32 (Remove Legacy Brace Blocks).
- Update specs/learn docs as part of the plan deliverables.
- Remove standby tests (`standalone-blocks`) once parser changes land.
