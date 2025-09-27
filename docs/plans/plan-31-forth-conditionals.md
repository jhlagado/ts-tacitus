# Plan 31 — Forth-Style Conditionals

## Status
- **State:** Draft (blocked on Plan 30)
- **Owner:** Tacit control-flow initiative
- **Prerequisites:** Plan 30 (immediate words + colon definitions + generic `;`)

## Goals
1. Implement `if … else … ;` using the immediate-word infrastructure from Plan 30.
2. Reuse the shared `;` terminator so conditionals follow the same closing discipline as colon definitions.
3. Update conditional documentation (`cond-control-flow`) once behaviour is implemented.

## Non-Goals
- Revising brace-based combinators (still legacy for now).
- Introducing additional control words (`do`, `loop`, etc.) — they will follow after this plan.

## Deliverables
- Immediate definitions for `if`, `else`, and their closer helper that manage branch placeholders on the VM stacks.
- Regression tests covering single-branch (`if … ;`) and dual-branch (`if … else … ;`) forms.
- Updated conditional spec and brief release notes.

## Work Breakdown
1. **Immediate words**
   - Mark `if` and `else` immediate, pushing their closer code reference onto the VM data stack and recording branch placeholders.
   - Provide the closer helper executed via `;` that patches remaining offsets.
2. **Testing**
   - Add regression tests for nested conditionals, REPL usage, and error cases (stray `else`, missing `;`).
3. **Docs**
   - Refresh `cond-control-flow` to match the implementation.

## Dependencies
- Requires Plan 30 completion (immediate infrastructure, colon definitions, generic `;`).
