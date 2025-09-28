# Conditional Control Flow — Draft Specification

## Status
- **Stage:** exploratory draft
- **Scope:** Forth-style conditional words `if`, `else`, terminating `;`
- **Not yet implemented:** immediate word infrastructure, compiler updates, tests

## Goals
- Bring Tacit control flow in line with traditional Forth: conditions on the data stack, immediate words build the branch scaffolding.
- Use a single terminator `;` for all control constructs. The matching closer is provided by the opener.
- Keep braces-based combinators available temporarily, but treat them as legacy once the immediate-word path lands.

## Surface Syntax
```
<cond> if   …true-branch…   ;
<cond> if   …true-branch…   else   …false-branch…   ;
```
- `if` is followed by straight-line code until the terminating `;` (or `else`).
- `else` is optional. If present it must appear before the same terminator.
- Nested conditionals work because each opener pushes its own closer; the innermost `;` resolves first.

- `;` is the `eval` word marked immediate. It simply pops the top code reference (e.g. `toTaggedValue(Op.EndIf, Tag.BUILTIN)`) from the VM data stack and **invokes** it immediately. No new bytecode is emitted; the closer executes at once and may itself append to the code buffer.
- Each opener (`if`, future `do`, colon definitions, etc.) is responsible for pushing the appropriate closing word onto the stack before control can reach `;`.

## Runtime Model
- The guard value is produced **before** `if` and left on the stack.
- At compile time `if` emits `IfFalseBranch <placeholder>` and records the placeholder address on the VM data stack.
- At runtime the generated `IfFalseBranch` pops the guard: zero skips the true branch; non-zero executes it.
- `else` compiles an unconditional `Branch` over the false branch and patches the outstanding placeholder.
- The terminator (`;`) ultimately executes the stored closer (`endif`-like helper) which patches remaining placeholders and finalises the construct.

## Bytecode Lowering
1. **`if` (immediate)**
   - Push the current data-stack depth marker onto the VM return stack.
   - Emit `IfFalseBranch 0` and push its patch address onto the data stack.
   - Push the closing word reference (e.g. `toTaggedValue(Op.EndIf, Tag.BUILTIN)`) so `;` can resolve it later. Future user-defined closers may push `Tag.CODE` values.
2. **True branch**
   - Straight-line compilation of user code.
3. **`else` (immediate, optional)**
   - Emit `Branch 0` and push its patch address.
   - Patch the most recent `IfFalseBranch` to target the start of the false branch.
   - Push the closing word reference again (so the final `;` still resolves correctly).
4. **False branch**
   - Straight-line compilation of user code (if `else` present).
5. **Terminator `;` (immediate)**
   - Ensure TOS is executable (`isExecutable`: accepts `Tag.BUILTIN` and `Tag.CODE`); if not, raise a compile-time error (`Unexpected ';'`).
   - Pop the reference and call `eval` on it immediately. The closer patches any remaining placeholders and finalises bookkeeping.

## Compiler Use of VM Stacks
- Immediate words run inside the VM; they use the VM's own data and return stacks for bookkeeping.
- **Data stack slots:** every placeholder address (from `IfFalseBranch` or `Branch`) is pushed during compilation and popped when patched.

## Error Handling
- `if` requires at least one stack item at runtime; guard runs and leaves a boolean/number.
- `;` raises a compile-time error if no closer reference is on TOS.
- Mismatched `if`/`else`/`;` sequences (e.g., stray `else`, missing `;`) are reported during compilation when the closer detects unexpected stack state.

## Examples
### Simple Conditional
```
value even
if
  "even"
;
```

### Conditional with Else
```
value even
if
  "even"
else
  "odd"
;
```

## Open Questions / TODOs
1. Specify exact closer implementation (e.g., a dedicated `endif` helper) that `;` invokes.
2. Decide whether a shorthand (`iff`) is still desirable or redundant under the Forth model.
3. Flesh out error messages for missing or extra terminators.
4. Integrate with forthcoming immediate-word and colon-definition changes.
