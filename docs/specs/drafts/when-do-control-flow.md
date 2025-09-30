# `when … do` Control Flow (Draft, Normative)

Status
- Stage: design draft (renamed tokens: `case` → `when` opener, `of` → `do` clause body)
- Depends on: Plan 31 (`;` generic closer infrastructure), Plan 32 (brace-block removal)
- Scope: Immediate-word control structure compiled with fixed arity. All compiler state MUST live on the VM data stack (no hidden side state). Design keeps Tacit’s Forth‑style immediate metaprogramming.

Overview
Tacit’s `when … <predicate> do <body> ; … ;` is a guarded multi‑clause construct that converges to a single exit. There is no managed discriminant; each clause supplies its own predicate. Predicates are ordinary Tacit code and must leave a single numeric flag (0=false, non‑zero=true). The author is responsible for duplicating/consuming any values used in predicates and bodies.

Example (locals)
```tacit
10 var x
when
  x 3 eq     do  "three"         ;
  x 27 eq    do  "twenty-seven"  ;
                "default"
;
```

Example (transient value)
```tacit
10 when
  dup 3 eq    do  "three"         ;
  dup 27 eq   do  "twenty-seven"  ;
                 "default"
;
drop   \ caller cleans up transient value after the construct
```

Design goals (Normative)
- Immediate words only; no new grammar or recursive‑descent.
- Fixed arity: a clause predicate leaves exactly one flag; no variadic detection.
- All compiler state on the data stack (numbers and BUILTIN closers).
- Retain generic `;` closer: it executes the closer reference currently on TOS.

Semantics summary
- when (immediate opener): Opens the construct. Emits a two‑instruction prologue that:
  - `Branch +3` (skip the next instruction)
  - `Branch +0` anchor (forward), operand address recorded as `anchorPos`
  - Push `anchorPos`; push EndWhen closer on the data stack (EndWhen at TOS)
- do (immediate): Ends the predicate region and begins the body:
  - Emits `IfFalseBranch` and reserves its 16‑bit operand; let `p_false = CP`.
  - Pushes `p_false`; pushes EndDo closer (closes one clause at the next `;`).
- `;` (generic, immediate):
  - If closer = EndDo: clause close (see below)
  - If closer = EndWhen: whole construct close (see below)
- Default body: Any code after the last clause’s `;` and before the final `;` (EndWhen) is the default.

Lowering rules (Normative)
Let CP be the current compile pointer (bytecode index).

- when (opener):
  1) compile `Branch`; compile16(3)     // skip over the next 3 bytes (one Branch instruction)
  2) compile `Branch`; let `anchorPos = CP`; compile16(0)
  3) push `anchorPos`; push EndWhen closer  (EndWhen remains at TOS)

- do (clause body begins):
  1) compile `IfFalseBranch`; let `p_false = CP`; compile16(0)
  2) push `p_false`; push EndDo closer  (clause is now open)

- Clause `;` (EndDo executes):
  1) Pop `p_false` (must be a finite, non‑negative integer).
  2) Temporarily pop EndWhen closer, then pop `anchorPos` beneath it.
  3) Emit a backward `Branch` to the anchor’s opcode and compute its offset immediately:
     ```
     compile `Branch`;
     const pBack = CP;
     const targetOpcode = anchorPos - 1;         // opcode byte before anchor operand
     const offBack = targetOpcode - (pBack + 2); // relative from after operand
     compile16(offBack);
     ```
  4) Restore compile‑time stack: push `anchorPos`, then push EndWhen closer (EndWhen back to TOS).
  5) Patch `p_false` to `here` (fallthrough for the false condition):
     ```
     const here = CP;
     const offFalse = here - (p_false + 2);
     const prev = CP; CP = p_false; compile16(offFalse); CP = prev;
     ```

- Final `;` (EndWhen executes):
  1) Pop EndWhen closer, then pop `anchorPos`.
  2) Patch the anchor’s forward branch to `here`:
     ```
     const here = CP;
     const off = here - (anchorPos + 2);
     const prev = CP; CP = anchorPos; compile16(off); CP = prev;
     ```

Explicit control flow (Normative)
- Predicate true:
  - IfFalseBranch does not jump → fallthrough into body.
  - Clause `;` emits backward Branch to the anchor; the anchor’s forward Branch will be patched to the final exit → skips all remaining clauses and default.
- Predicate false:
  - IfFalseBranch jumps over the body to the patched `here` → next predicate or the default; if no default, to the common exit.

Compile‑time stack discipline
- During opener body:
  - TOS: EndWhen closer
  - Under EndWhen: anchorPos (number)
- During an open clause (after do, before clause `;`):
  - TOS: EndDo closer
  - Next: p_false (number)
  - Next: EndWhen closer
  - Next: anchorPos (number)
- No other numbers are pushed by this construct; ordinary literals are compiled, not stacked.

Errors and validation (Normative)
- “DO without WHEN opener”: `do` requires an open `when`; EndWhen closer must be present beneath.
- “Unclosed WHEN”: At end of program, any remaining EndWhen closer triggers a syntax error.
- “ENDDO invalid placeholder”: Clause `;` must pop a finite, non‑negative `p_false`.

Truth domain
- Numeric: 0=false; non‑zero=true (as per Tacit).

Alternative single‑jump variant (Informative)
- An RSTACK SP snapshot can be used to collect per‑clause exit placeholders and patch them directly to the final exit (single jump). This requires rpush SPCells at `when`, pushing each clause’s `p_exit` beneath EndWhen, and rpop at `EndWhen` to count and patch `k` placeholders.

Implementation sketch (Informative)
- Opcodes (compile‑time closers): `Op.EndDo`, `Op.EndWhen`.
- Meta (new): `beginWhenImmediate()` [opener], `beginDoImmediate()` [body], `ensureNoOpenWhen()`.
- Registration:
  - `when` → immediate opener, beginWhenImmediate
  - `do` → immediate body, beginDoImmediate
  - `enddo` → Op.EndDo (executed by generic `;`)
  - `endwhen` → Op.EndWhen (executed by generic `;`)
- Parser validation: `ensureNoOpenWhen()` alongside other final checks.

Worked examples

1) No‑op
```tacit
when ;
\ Emits nothing. EndWhen sees nothing to patch.
```

2) Default‑only
```tacit
when
  "default"
;
\ Only default code compiles; EndWhen patches anchor to final exit.
```

3) Single clause, no default
```tacit
when
  x 3 eq  do  "three"  ;
;
\ true → run body → back‑branch to anchor → forward to exit
\ false → skip body → exit
```

4) Single clause + default
```tacit
when
  x 3 eq  do  "three"  ;
  "default"
;
\ true → run body → back to anchor → forward to exit (skips default)
\ false → fall through to default → exit
```

5) Multiple clauses
```tacit
when
  p0  do  b0  ;
  p1  do  b1  ;
  p2  do  b2  ;
  dflt
;
\ Each clause close emits a back‑branch to the single anchor; EndWhen patches the anchor to the exit after dflt.
