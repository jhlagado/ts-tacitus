# Terms

* **svalue**: the source value (what you’re writing).
* **dvalue**: the destination value designator (a variable plus optional `[]` path).
* **path-block**: the compiled code captured from inside `[...]`. For now it evaluates to **one simple index** on the stack.

# Surface syntax (locals shown; applies to any variable class)

```
30 var x
(1 2 3) var y

y[0]          \ read (dvalue as rvalue)
3 -> y[1]     \ write (svalue -> dvalue)
```

# Parser treatment of `[]`

* `[` … `]` is **special**: the parser compiles the enclosed tokens into a separate code object (**path-block**) without executing it now.
* The whole `base [ … ]` is reduced to a **single dvalue node** carrying:

  * a **base designator** (e.g., local `y`)
  * a **path-block handle** (code pointer)

No whitespace sensitivity: `y[1]` ≡ `y [ 1 ]`.

# Opcode palette (minimal)

* `LOAD_LOCAL <off>` → `( — val )`
* `FETCH_INDEX` → `( base idx — elem|NIL )`
* `STORE_INDEX_SIMPLE` → `( s base idx — )`  (in-place simple write; span checks elided for now)
* `CALL <codeptr>` → executes a compiled block (no new frame), leaving its results on the stack
* (Analogous `LOAD_*` exist for globals/fields; address model abstracted)

# Compilation patterns

## 1) Read: `y[ idxBlock ]`

Parser yields: base=`y`, path-block=`pb`.

Emit:

```
LOAD_LOCAL y_off           ; -- y
CALL pb                    ; -- y idx
FETCH_INDEX                ; -- elem | NIL
```

## 2) Write: `svalue -> y[ idxBlock ]`

General form is always: **evaluate svalue**, then **evaluate dvalue**, then store.

Emit (in this order):

```
<code for svalue>          ; -- s
LOAD_LOCAL y_off           ; -- s y
CALL pb                    ; -- s y idx
STORE_INDEX_SIMPLE         ; -- ·
```

Notes:

* If you later allow multi-step paths, `FETCH_INDEX`/`STORE_INDEX_*` become “walkers” over K indices; for now K=1.
* If the write target is incompatible or non-simple, behavior is TBD (hard crash vs silent noop). This is a policy above codegen.
* Reads out-of-range must return `NIL` (handled inside `FETCH_INDEX`).

# Evaluation order (locked)

* `[]` blocks are compiled at parse time; **executed at use-time** exactly where `CALL pb` appears.
* `->` is a normal postfix operator: compile **svalue**, then **dvalue**, then the store op. No statement fences needed.
