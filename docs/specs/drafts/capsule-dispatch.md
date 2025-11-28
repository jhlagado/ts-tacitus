## Tacit Dispatch Sugar: Double Colon (`::`) Syntax

### Overview

This extension introduces an **immediate word** `::` that simplifies capsule method dispatch in Tacit. It provides a concise, postfix-friendly way to invoke methods on capsules, aligning with Tacit's RPN style and immediate-word convention system.

### Purpose

Standard capsule dispatch currently requires three parts:

```
[argN ... arg1] 'method &capsule dispatch
```

The `::` syntax simplifies this into:

```
[argN ... arg1] &capsule :: method
```

Where `::` is an immediate word that compiles the method symbol and a specialized dispatch opcode.

### Syntax and Semantics

* `::` must be followed by a **word token**, typically a symbol (e.g., `move`, `draw`, `reset`).

* When `::` is encountered during compilation, it performs two actions:

  1. **Compiles** a literal push of the following token as a symbol:

     ```
     'method
     ```
  2. **Compiles** a dedicated opcode:

     ```
     Op.DispatchSymbol
     ```

* At runtime, the stack layout prior to dispatch is:

```
[argN ... arg1] [receiver capsule] [method symbol]
```

* `Op.DispatchSymbol` consumes the receiver and symbol, then performs a capsule dispatch.

### Example

#### Source Code:

```
10 20 &p :: move
```

#### Compiled Form:

```
push 10
push 20
push-ref &p
push-symbol 'move
Op.DispatchSymbol
```

### Benefits

* Eliminates the need for `'symbol &capsule dispatch` verbosity.
* Keeps symbol names syntactically visible and decoupled from sigils.
* Leverages Tacit's existing immediate word machinery.
* Encapsulated via a distinct opcode, avoiding confusion with legacy `dispatch`.

### Notes

* The symbol following `::` must be statically known.
* `Op.DispatchSymbol` is intended to fully replace the older `dispatch` opcode long-term.

### Future Considerations

* Once `::` and `Op.DispatchSymbol` are stable, the legacy `dispatch` opcode may be deprecated and removed.
* Additional sugar (e.g. `with` blocks or macro forms) can build on this primitive.
