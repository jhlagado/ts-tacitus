# Plan 42 — Immediate Execution Unification

Status: Draft  
Owner: Language & VM Team  
Last updated: 2025-11-14

## 1. Motivation

Tacit currently has two separate pathways for “immediate” evaluation:

1. **Parser-immediates** — hard-wired checks in the parser that call bespoke routines (e.g. `if`, `;`, `finally`).
2. **Dictionary-immediates** — entries flagged as immediate words and executed during compilation (a la Forth).

This split has grown ad hoc; parser immediates bypass the dictionary entirely, which makes the system brittle, complicates extensions, and prevents users from defining new compile-time behaviour the way classic Forth does. We want one unified mechanism where immediates live in the dictionary, yet the parser can still invoke them efficiently when it must.

## 2. Goals

- Consolidate all immediate execution behind the dictionary.
- Allow the parser to fall back to dictionary immediates instead of hardcoded branching.
- Preserve performance by keeping the fast path for common constructs.
- Document the new immediate contract so future features follow the same pattern.

## 3. Non-goals

- No attempt to add macro systems or hygienic compile-time programming.
- No change to existing user-facing syntax beyond the unified behaviour.
- No removal of strict compile-time validation (e.g. arity checks, structure checks).

## 4. Current State (Baseline)

| Source                     | Behaviour                                |
| -------------------------- | ---------------------------------------- |
| Parser-immediate handlers  | `switch` in `parser.ts` dispatching to bespoke routines; bypasses the dictionary. |
| Dictionary immediate flag  | Used narrowly for a few core constructs; not consulted by the parser in many cases. |
| VM support                 | `executeImmediateWord` exists but is not the central path. |

Pain points:

- Users cannot define new immediate words that cooperate with the parser.
- Certain keywords (`finally`, list syntax) are impossible to override or extend without changing the parser.
- Two code paths must be kept in sync whenever semantics change.

## 5. Proposed Approach

### Step 1 — Inventory & Classification

- List every parser-immediate today (conditionals, definition terminators, `finally`, etc.).
- Classify behaviour: “pure compile-time effect”, “compile-time rewrite emitting bytecode”, “pure parser control”.

### Step 2 — Dictionary Contract

- Define a dictionary flag (reuse existing immediate flag) plus metadata describing the expected compile-time stack effect.
- For each parser-immediate, add (or expose) a dictionary word representing the same behaviour.
- Ensure words have access to necessary compiler/VM state via well-defined APIs (e.g. the existing `compiler` scaffolding).

### Step 3 — Parser Refactor

- Replace hardcoded branches with a lookup + “if immediate flag set then execute via compiler helper”.
- Maintain a whitelist for syntax-critical markers (`:` start, EOF) where direct parser control is still required.
- Provide a fast inline path for the most common constructs to avoid performance regressions (e.g. cached function pointers).

### Step 4 — VM Enhancements

- Audit `executeImmediateWord` to make sure it exposes the right context (current definition, compile/load state, etc.).
- Provide helper opcodes or compiler APIs needed by immediates now being moved out of the parser (e.g. wrappers for `ERR`/`IN_FINALLY` manipulations).

### Step 5 — Testing & Documentation

- Add regression tests for each rewritten immediate (ensuring both compile-time and runtime behaviour match previous semantics).
- Provide examples in `docs/learn` showing how a user-defined immediate can be registered.
- Update developer docs describing the new contract, including how parser tokens map to dictionary entries.

## 6. Risks & Mitigations

- **Performance regression** — mitigate by caching the function pointer for frequent immediates and profiling the parser after changes.
- **Incomplete context for immediates** — ensure the compiler exposes APIs for manipulating definitions, bytecode streams, and error reporting.
- **Compatibility gaps** — run the entire test suite and compile existing programs to confirm semantics remain intact.

## 7. Success Criteria

- All existing hardwired immediates (except unavoidable syntax markers) are implemented as dictionary words.
- Users can introduce their own immediates by defining dictionary entries flagged as immediate.
- Parser logic is simplified to “lookup → dispatch” rather than `switch`-heavy code.
- Performance matches or exceeds the current baseline (within measurement noise).

## 8. Follow-ups

- Explore optional macro hooks or DSL support once the immediate pathway is unified.
- Decide whether to expose compile-time namespaces or visibility rules for immediates.

---

> Draft pending deeper compiler audit; scheduling approval required before implementation.

