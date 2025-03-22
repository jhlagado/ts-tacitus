# Tacit Language: Deferred Execution, Thunks, and Purity Recap

## 1. Deferred Execution and Thunks

- Any operator in Tacit can receive a **deferred block of code** (a thunk) as an argument.
- Operators apply **polymorphic forcing**: if an operand is a thunk, it is executed automatically before the operator proceeds.
- This behavior is uniform across all operations—Boolean, arithmetic, list-based, etc.
- A special operator may be introduced to *refer* to a thunk without forcing it, mainly for storing constants.

## 2. Conditionals and Short-Circuiting

- Short-circuit behavior (e.g., in AND, OR) is possible **only** when operands are deferred.
- Conditional logic is modeled using thunks:
  - A simple `if-then` is a short-circuiting AND.
  - A full ternary operator (`ifelse`) takes a predicate, a then-clause, and an else-clause—each possibly deferred.
  - The operator forces only the condition and the selected branch.

## 3. Net Arity and Arity Tracking

- **Net arity** is the difference between the number of values consumed and produced by a block.
- All thunks are assumed to be **zero arity**—they do not consume anything from the stack.
- Runtime checks can compare the **expected arity** of a thunk to its actual effect on the stack.
- Violations can throw runtime errors for debugging or validation.

## 4. Static Analysis and Arity Inference

- Net arity is **compositional**: the net arity of a sequence is the sum of the net arities of its components.
- Deferred blocks can be analyzed recursively to determine their net arity.
- This enables future **static analysis**, but is not required for the current runtime behavior.

## 5. Caching and Memoization of Thunks

- A global **lookup table** will cache the net arity of deferred code blocks using their code pointer.
- If a thunk is **zero-arity and pure**, its result can be **memoized** and reused.
- This behavior is optional and can be added later as an optimization.

## 6. Purity and Side-Effects

- Tacit enforces that **only the beginning or end** of a sequence may contain impure operations (e.g. I/O, API calls).
- The core of any sequence—between the source and the sink—must remain **pure**.
- Runtime checks may enforce this constraint, with possible static enforcement in the future.
