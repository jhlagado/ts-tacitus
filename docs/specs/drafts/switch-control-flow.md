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
- `case` (immediate): Opens a switch context. Emits no bytecode. Pushes an EndCase closer on the data stack.
- `of` (immediate): Starts a clause guarded by the immediately preceding predicate (which leaves a single flag on TOS at runtime).
  - Emits `IfFalseBranch` with a forward 16‑bit placeholder.
  - Pushes the placeholder (number) then pushes an EndOf closer.
- `;` (generic closer, immediate): Executes whichever closer is at TOS:
  - If it is EndOf: closes the current clause (patch false branch, emit and collect an exit branch placeholder).
  - If it is EndCase: closes the whole construct (patch all clause exit branches to the common exit).
- Default body: Any code between the last clause `;` and the final `;` (EndCase) is the default.

Immediate Words and Closers (API)
- case       → immediate word (pushes EndCase closer)
- of         → immediate word (emits IfFalseBranch, pushes placeholder then EndOf closer)
- ;          → generic immediate that `eval`s the code reference at TOS (already implemented globally)
- endof      → BUILTIN closer opcode (not normally typed by users; executed via `;`)
- endcase    → BUILTIN closer opcode (ditto)

All compiler-time state for an open case is represented on the VM data stack as:
- One EndCase closer (BUILTIN ref) for the open switch
- Zero or more numeric placeholders (exit branches) collected directly beneath EndCase during clause closures
- For an active, not-yet-closed clause: the stack will additionally have a numeric false-branch placeholder and an EndOf closer on TOS until the clause’s `;` executes

Lowering Rules (Normative)
Let CP be the current compile pointer (bytecode index).
- of (predicate already compiled and leaves a flag at runtime):
  1) compile Opcode: `IfFalseBranch`
  2) let `p_false = CP`; compile16(0) to reserve a forward offset
  3) push `p_false`
  4) push EndOf (BUILTIN ref to `Op.EndOf`)
- ; in a clause (EndOf executes):
  1) Pop `p_false` (number)
  2) Emit `Branch`; let `p_exit = CP`; compile16(0) to reserve an exit placeholder that should jump to the common exit
  3) Keep EndCase at TOS while stashing `p_exit` beneath it:
     - Pop EndCase closer (BUILTIN), push `p_exit` (number), push EndCase closer
  4) Patch `p_false` to `here` (current CP) so non-matching flows fall through to the next clause or default
- Final ; (EndCase executes):
  1) Pop EndCase closer
  2) While TOS is a finite number: pop `p_exit`, patch it to `here`
  3) Done

Explicit Control-Flow on Predicate Result (Normative)
- Predicate true (non‑zero flag when `of` runs):
  - The `IfFalseBranch` does not jump; execution falls through into the clause body.
  - At the clause terminator `;` (EndOf), a `Branch` to the common exit is emitted and later patched by EndCase, so execution skips all remaining clauses and the default.
- Predicate false (zero flag when `of` runs):
  - The `IfFalseBranch` takes the jump to its patched target, which is the first instruction after the clause body (the point EndOf patched `p_false` to).
  - Execution continues with the next clause’s predicate if present; otherwise into the default body; if no default exists, it falls through to the common exit.

Note on Numbers on the Compile-Time Stack
During parsing, ordinary literals are compiled to bytecode; they are not kept on the VM data stack. The only numbers placed on the VM data stack during compilation are placeholders we explicitly push (branch positions). Therefore, “pop while TOS is a finite number” is safe and will not consume user data.

Stack Discipline (Compile-Time)
- ONLY numeric placeholders (branch positions) and BUILTIN closer references are pushed by this construct.
- Invariants:
  - EndCase is always present as the topmost closer for an open switch.
  - After `of`, TOS is EndOf; under it is the numeric `p_false`.
  - After EndOf executes, TOS returns to EndCase; under EndCase is a (possibly empty) pack of numeric exit placeholders gathered so far.
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
  // Require parser state if desired (like IF does); actual state is on stack:
  // Push EndCase closer.
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

  // Emit exit branch placeholder that will be patched by EndCase.
  vm.compiler.compileOpcode(Op.Branch);
  const pExit = vm.compiler.CP;
  vm.compiler.compile16(0);

  // Keep EndCase at TOS while stashing pExit beneath it.
  const closer = vm.pop(); // must be EndCase (BUILTIN)
  vm.push(pExit);
  vm.push(closer);

  // Patch the predicate's false branch to fall through here.
  const endAddr = vm.compiler.CP;
  const offset = endAddr - (Math.trunc(pFalse) + 2);
  const prev = vm.compiler.CP;
  vm.compiler.CP = Math.trunc(pFalse);
  vm.compiler.compile16(offset);
  vm.compiler.CP = prev;
};
```

Closer: endCaseOp (executed via generic `;`)
```ts
export const endCaseOp: Verb = (vm: VM) => {
  // Pop EndCase closer.
  vm.ensureStackSize(1, 'endcase');
  const closer = vm.pop(); // discard; type checking is optional here

  // Patch all collected exit branches to this point.
  const here = vm.compiler.CP;
  while (vm.SPCells > 0) {
    const top = vm.peek();
    if (!Number.isFinite(top)) break;
    const pExit = Math.trunc(vm.pop());
    const off = here - (pExit + 2);
    const prev = vm.compiler.CP;
    vm.compiler.CP = pExit;
    vm.compiler.compile16(off);
    vm.compiler.CP = prev;
  }
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

Worked Examples (Normative Behavior)

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
\ Each clause’s EndOf emits and records an exit branch; EndCase patches all to exit after dflt.
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
