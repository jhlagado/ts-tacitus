# Plan 52 – Immediate Word Unification

## Goal

Gradually migrate Tacit's immediate words so they live in the dictionary as regular verbs (meta bit set), mirroring classic Forth semantics. Parser should perform a single lookup: if the payload has `meta=1`, execute the verb immediately; otherwise emit a call. Remove bespoke parser branches and handler maps.

## Stage Breakdown

1. **Tokenizer plumbing**
   - Add `currentTokenizer` field on `VM`.
   - Ensure every parse entry (`parse`, Tacit compile-loop bridge) sets it before consuming tokens and clears it afterward.

2. **`:`, `;` migration**
   - Convert their handlers into standard op verbs (no tokenizer argument; pull from `vm.currentTokenizer`).
   - Register them via `define` with `meta=1`.
   - Update parser lookup (`emitWord`) to execute immediates when `meta=1`; remove special casing for `:`/`;`.

3. **Conditional family**
   - Move `if`, `else`, match/with, case/do, capsule handlers into verbs; drop `registerImmediateHandler`.
   - Simplify `executeImmediateWord` to only rely on dictionary verbs (no handler map).

4. **Compiler specials**
   - Convert `var`, `->`, `global`, `+>` to immediates.
   - Remove explicit parser branches for these keywords.

5. **Cleanup**
   - Delete obsolete handler registry, `ImmediateSpec` array, and any remaining parser hacks.
   - Ensure tests cover immediate execution via dictionary lookup.

## Notes

- Migration happens stage-by-stage; after each stage run full tests & lint.
- Maintain backward compatibility while intermediate handlers coexist.
***
