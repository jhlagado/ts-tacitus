# `case/of` Control Flow (Draft, Normative)

Status
- Stage: design draft
- Depends on: Plan 31 (`;` generic closer infrastructure), Plan 32 (brace-block removal)
- Scope: Immediate-word based control structure that compiles to conditional branches using fixed-arity semantics. All compiler state MUST be kept on the VM’s data stack (no hidden parser/global side state).

Overview
Tacit’s `case … of … ; … ;` is a structured metaprogramming construct (Forth-style) for chaining guarded clauses that converge to a single exit point. Unlike traditional “switch” constructs, `case` does not manage a discriminant for you. Predicates are ordinary Tacit code that may read locals/globals or manipulate transient stack values. The programmer is responsible for duplicating/consuming any values needed by each predicate.

Example (locals)
```tacit
10 var x
case
  x 3 eq      of  "three"  ;   \ clause 0
  x 27 eq     of  "twenty-seven"  ;   \ clause 1
               "default"            \ default (optional)
;
```

Example (transient value)
```tacit
10 case
  dup 3 eq     of  "three"  ;
  dup 27 eq    of  "twenty-seven"  ;
                 "default"
;
drop   \ caller is responsible for cleaning any transient if used
```

Design Goals (Normative)
- Immediate-word driven: no grammar, no recursive-descent; uses the same closer stack pattern as `if … else … ;`.
- Fixed arity only:
  - `of` consumes exactly one runtime flag (truthy/falsy number) produced by the preceding predicate code.
  - No variadic introspection or heuristic detection of predicate arity.
- Compiler state lives on the data stack:
  - Placeholders are numbers (branch address positions).
  - Closers are BUILTIN code references.
  - No extra state in parser structs beyond what already exists for lists/definitions/conditionals.

Semantics Summary
- `case` (immediate): Opens a switch context. Emits a two‑instruction prologue so the common exit is reachable without scanning/counting and normal entry skips it:
  - `Branch +3` to skip over the next instruction (a fixed 3‑byte branch).
  - `Branch +0` (forward) as the anchor to the common exit, with its 16‑bit operand address recorded as `anchorPos` (patched by EndCase). The first branch guarantees the anchor is not executed on entry.
  - Push `anchorPos` beneath an EndCase closer on the data stack.
- `of` (immediate): Starts a clause guarded by the immediately preceding predicate (which leaves a single flag on TOS at runtime).
  - Emits `IfFalseBranch` with a forward 16‑bit placeholder.
  - Pushes the placeholder (number) then pushes an EndOf closer.
- `;` (generic closer, immediate): Executes whichever closer is at TOS:
  - If it is EndOf: closes the current clause by emitting a backward `Branch` to the anchor and patching the clause’s `p_false` to fall through.
  - If it is EndCase: closes the construct by patching the single anchor’s forward branch to the common exit.
- Default body: Any code between the last clause `;` and the final `;` (EndCase) is the default.

Immediate Words and Closers (API)
- case       → immediate word (pushes EndCase closer)
- of         → immediate word (emits IfFalseBranch, pushes placeholder then EndOf closer)
- ;          → generic immediate that `eval`s the code reference at TOS (already implemented globally)
- endof      → BUILTIN closer opcode (not normally typed by users; executed via `;`)
- endcase    → BUILTIN closer opcode (ditto)

All compiler-time state for an open case is represented on the VM data stack as:
- One EndCase closer (BUILTIN ref) for the open switch
- One numeric anchor position (branch operand address) directly beneath EndCase; this forward-branch placeholder is emitted by `case` and later patched by EndCase to the common exit
- For an active, not-yet-closed clause: the stack will additionally have a numeric false-branch placeholder and an EndOf closer on TOS until the clause’s `;` executes

Lowering Rules (Normative)
Let CP be the current compile pointer (bytecode index).
- of (predicate already compiled and leaves a flag at runtime):
  1) compile Opcode: `IfFalseBranch`
  2) let `p_false = CP`; compile16(0) to reserve a forward offset
  3) push `p_false`
  4) push EndOf (BUILTIN ref to `Op.EndOf`)
- ; in a clause (EndOf executes):
  1) Pop `p_false` (number).
  2) Temporarily pop the EndCase closer, then pop the `anchorPos` number beneath it (the operand address of the anchor branch emitted by `case`). Emit a backward `Branch` that jumps to the anchor’s opcode and compute its offset immediately:
     ```
     vm.compiler.compileOpcode(Op.Branch);
     const pBack = vm.compiler.CP;
     const targetOpcode = Math.trunc(anchorPos) - 1;     // anchor opcode byte before its operand
     const off = targetOpcode - (pBack + 2);             // relative from after operand
     vm.compiler.compile16(off);
     ```
     Restore compile-time stack order by pushing `anchorPos` then the EndCase closer back onto the data stack.
  3) Patch `p_false` to `here` (current CP) so non-matching flows fall through to the next clause or default.
- Final ; (EndCase executes):
  1) Pop EndCase closer.
  2) Pop `anchorPos` (number) and patch the anchor’s forward branch to `here`:
     ```
     const here = vm.compiler.CP;
     const off = here - (Math.trunc(anchorPos) + 2);   // patch operand of anchor Branch
     const prev = vm.compiler.CP;
     vm.compiler.CP = Math.trunc(anchorPos);
     vm.compiler.compile16(off);
     vm.compiler.CP = prev;
     ```
  3) Done.

Explicit Control-Flow on Predicate Result (Normative)
- Predicate true (non‑zero flag when `of` runs):
  - The `IfFalseBranch` does not jump; execution falls through into the clause body.
  - At the clause terminator `;` (EndOf), a `Branch` to the common exit is emitted and later patched by EndCase, so execution skips all remaining clauses and the default.
- Predicate false (zero flag when `of` runs):
  - The `IfFalseBranch` takes the jump to its patched target, which is the first instruction after the clause body (the point EndOf patched `p_false` to).
  - Execution continues with the next clause’s predicate if present; otherwise into the default body; if no default exists, it falls through to the common exit.

Note on Numbers on the Compile-Time Stack
During parsing, ordinary literals are compiled to bytecode; they are not kept on the VM data stack. The only numbers placed on the VM data stack by this construct are:
- `p_false` (clause-local false-branch placeholder), which is consumed by EndOf, and
- `anchorPos` (the operand address of the case anchor), which is consumed by EndCase.
No variadic scanning or “pop while number” loops are required.

Stack Discipline (Compile-Time)
- ONLY numeric placeholders (branch positions) and BUILTIN closer references are pushed by this construct.
- Invariants:
  - EndCase is always present as the topmost closer for an open switch.
  - After `of`, TOS is EndOf; under it is the numeric `p_false`.
  - After EndOf executes, TOS returns to EndCase; directly beneath EndCase is the single numeric `anchorPos` (no collection of exits).
  - The `case` prologue guarantees normal entry jumps over the anchor using a fixed `Branch +3`, keeping fixed-arity operations and avoiding any scanning/counting.
- Nesting is naturally LIFO: any nested immediates (e.g., `if … ;`) push their own closers above EndOf/EndCase and are closed by their own `;` before the outer one is visible to `;`.

Fixed Arity Constraints (Normative)
- Predicate arity: a clause predicate MUST leave exactly one numeric truthy/falsy flag at runtime. The `of` lowering emits `IfFalseBranch` which expects one flag on the data stack; nothing else is inspected or removed at compile time.
- Value management: if you are matching against a transient value, explicitly `dup`/`drop` as needed in your predicates and bodies.

Errors and Validation (Normative)
- “OF without CASE”: `of` sees no EndCase closer anywhere above it on the compile-time stack (or TOS is not EndCase when expected).
- “Unclosed CASE”: At end of program (validateFinalState), any EndCase closer left on the data stack triggers a syntax error.
- “Unexpected semicolon”: If `;` runs with no recognizable closer at TOS, the generic `;` machinery already throws (existing behavior).
- EndOf validations:
  - The popped placeholder must be a finite number; otherwise raise “ENDOF missing/invalid branch placeholder”.

Compiler Validation Hook
- `ensureNoOpenSwitches()` scans the VM data stack for an EndCase closer (BUILTIN `Op.EndCase`). If found, throw `SyntaxError('Unclosed CASE', vm.getStackData())`.
- Integrate alongside `ensureNoOpenDefinition()` and `ensureNoOpenConditionals()` in parser’s `validateFinalState`.

Runtime Opcodes (to be added)
- `Op.EndOf`     — clause closer, executed by generic `;` during compilation (not used at runtime)
- `Op.EndCase`   — whole switch closer, executed by generic `;` during compilation
Both opcodes operate only during compilation, similar to `Op.EndIf` and `Op.EndDefinition`.

Implementation Sketch (Informative)

Immediate: beginCaseImmediate
```ts
export function beginCaseImmediate(): void {
  // Emit a prologue that ensures the anchor is not executed on entry:
  // 1) Branch +3 to skip over the next Branch (1 opcode byte + 2 operand bytes)
  vm.compiler.compileOpcode(Op.Branch);
  vm.compiler.compile16(3);

  // 2) Anchor: a forward Branch whose operand we will patch at EndCase to the common exit
  vm.compiler.compileOpcode(Op.Branch);
  const anchorPos = vm.compiler.CP;
  vm.compiler.compile16(0);

  // Keep the anchor operand address beneath EndCase on the compile-time stack
  // Stack state (top ↓): EndCase, anchorPos
  vm.push(anchorPos);
  vm.push(createBuiltinRef(Op.EndCase));
}
```

Immediate: beginOfImmediate
```ts
export function beginOfImmediate(): void {
  // Requires an open CASE: EndCase closer must be present on compile-time stack.
  // Emit test: if-false branch with forward patch.
  vm.compiler.compileOpcode(Op.IfFalseBranch);
  const pFalse = vm.compiler.CP;
  vm.compiler.compile16(0);
  // Push placeholder then the clause closer.
  vm.push(pFalse);
  vm.push(createBuiltinRef(Op.EndOf));
}
```

Closer: endOfOp (executed via generic `;`)
```ts
export const endOfOp: Verb = (vm: VM) => {
  vm.ensureStackSize(1, 'endof');
  const pFalse = vm.pop();
  if (!Number.isFinite(pFalse) || Math.trunc(pFalse) < 0) {
    throw new SyntaxError('ENDOF invalid branch placeholder', vm.getStackData());
  }

  // Access anchor beneath EndCase, compute backward branch to it, then restore stack.
  vm.ensureStackSize(2, 'endof');
  const endCaseCloser = vm.pop(); // EndCase BUILTIN
  const anchorPos = vm.pop();     // numeric operand address of anchor branch

  // Emit direct backward branch to anchor’s opcode (two-step exit: anchor will branch to final exit).
  vm.compiler.compileOpcode(Op.Branch);
  const pBack = vm.compiler.CP;
  const targetOpcode = Math.trunc(anchorPos) - 1;
  const offBack = targetOpcode - (pBack + 2);
  vm.compiler.compile16(offBack);

  // Restore compile-time stack shape: anchorPos under EndCase on TOS.
  vm.push(anchorPos);
  vm.push(endCaseCloser);

  // Patch predicate’s false branch to fall through to next clause/default.
  const endAddr = vm.compiler.CP;
  const offFalse = endAddr - (Math.trunc(pFalse) + 2);
  const prev = vm.compiler.CP;
  vm.compiler.CP = Math.trunc(pFalse);
  vm.compiler.compile16(offFalse);
  vm.compiler.CP = prev;
};
```

Closer: endCaseOp (executed via generic `;`)
```ts
export const endCaseOp: Verb = (vm: VM) => {
  // Pop EndCase closer and its anchor position; patch anchor to the final exit.
  vm.ensureStackSize(2, 'endcase');
  vm.pop(); // EndCase
  const anchorPos = Math.trunc(vm.pop());

  const here = vm.compiler.CP;
  const off = here - (anchorPos + 2);
  const prev = vm.compiler.CP;
  vm.compiler.CP = anchorPos;
  vm.compiler.compile16(off);
  vm.compiler.CP = prev;
};
```

Registration (Informative)
- In `src/ops/opcodes.ts`: add `EndOf` and `EndCase`.
- In `src/lang/meta/index.ts`: export `beginCaseImmediate`, `beginOfImmediate`.
- In `src/ops/builtins-register.ts`:
  ```ts
  symbolTable.defineBuiltin('case', Op.Nop, _ => beginCaseImmediate(), true);
  symbolTable.defineBuiltin('of',   Op.Nop, _ => beginOfImmediate(),   true);
  symbolTable.defineBuiltin('endof',   Op.EndOf);
  symbolTable.defineBuiltin('endcase', Op.EndCase);
  ```
- In parser `validateFinalState`: call `ensureNoOpenSwitches()`.

Alternative Design: Single‑Jump Variant via RSTACK SP Snapshot (Informative)
Motivation
- Avoid the extra backward jump to the anchor (Option B) by collecting per‑clause exit placeholders and patching them all directly to the final exit. This yields a single jump from a taken clause body to the exit.

Fixed‑arity, stack‑only state
- Use the return stack to record a compile‑time SP snapshot at `case` open, then compute the exact number of placeholders at `endcase` without scanning for sentinels:
  - At `case`:
    - rpush the current data‑stack depth in cells (SPCells) before any case state is pushed.
    - Push EndCase closer on the data stack (TOS).
  - At each clause `;` (EndOf):
    - Emit `Branch +0` (forward) and push its operand address (pExit) beneath EndCase (temporarily pop EndCase to keep it at TOS), then patch `p_false` to fall through.
  - At final `;` (EndCase):
    - rpop the saved baseline SPCells → `base`.
    - Compute `count = currentSPCells - base`. This includes 1 EndCase closer plus `k` numeric pExit placeholders.
    - Pop EndCase, then iterate `k = count - 1` times:
      - Pop one numeric placeholder address and patch it to `here`.
    - Done

1) No-op
```tacit
case ;
\ Emits nothing. EndCase sees no exits to patch.
```

2) Default-only
```tacit
case
  ...default...
;
\ Compiles only the default code; EndCase patches nothing.
```

3) Single clause, no default
```tacit
case
  <pred> of  <body>  ;
;
\ If pred true → run body → branch to exit
\ If pred false → fall through to exit
```

4) Single clause + default
```tacit
case
  <pred> of  <body>  ;
  <default>
;
\ If pred true → run body → branch skips default → exit
\ If pred false → fall through → default → exit
```

5) Multiple clauses
```tacit
case
  p0 of  b0  ;
  p1 of  b1  ;
  p2 of  b2  ;
  dflt
;
\ Each clause’s EndOf emits a backward branch to the single anchor; EndCase patches the anchor to the exit after dflt.
```

Nesting
- Nested constructs (e.g., `if … ;` inside a clause body) push their own closers above EndOf. The first `;` encountered will close the innermost construct first, preserving LIFO semantics. The outer `;` will eventually close EndOf, and the final `;` will close EndCase.

Truth Domain
- Conditions use the standard numeric truth domain: 0 = false, non-zero = true.

Constraints and Guarantees
- No implicit duplication/destruction of operand values is performed by `case`/`of`; authors must manage values explicitly.
- All state is represented as stack items (numbers and BUILTIN closers); there is no auxiliary state required to implement the construct.

Testing Checklist (Informative)
- case ; (no-op)
- case default ; (default only)
- 1-clause without default
- 1-clause with default
- multi-clause with and without default
- nesting with `if … ;` inside a clause
- error: of without case
- error: unclosed case at EOF
- stack discipline preserved across compiles (no stray numbers/closers remain)
