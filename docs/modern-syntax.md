# Tacit Syntax and Combinator Design — Expanded Version (Sections 1 to 3)

---

## 1. Overview (Expanded)

Tacit is a stack-based programming language designed to combine the simplicity of FORTH with the structured power of modern functional programming.  
It prioritizes **compile-time control structures**, **pure stack flow**, and **minimal runtime overhead**.

The language introduces **combinators** as the central mechanism for control flow and sequence processing.  
Unlike conventional function calls, combinators take structured **compile-time blocks** using **curly braces `{}`** instead of runtime first-class functions.

Tacit **does not use closures** or runtime deferred blocks.  
All control and mapping are handled through **grammar-based blocks**, and all executable functions are defined using standard colon definitions (`:`...`;`).

This design achieves:

- Maximum runtime predictability and performance.
- Minimal memory usage and no captured environments.
- Readable, composable, and modular program flow.

Tacit encourages building larger programs by composing small, clear stack-based functions with a small number of built-in combinators.

---

## 2. Core Syntax Principles (Expanded)

Tacit's syntax is based on the following key principles:

### 2.1 Stack-first, Combinator-second

Tacit follows **Reverse Polish Notation (RPN)**:  
arguments are evaluated and placed onto the stack **before** a combinator or function is invoked.

Example:

```tacit
sequence map { dup * }
```

Here, `sequence` is evaluated first, placed on the stack, and then `map` is applied along with its associated block.

---

### 2.2 Curly Braces `{}` Define Compile-Time Blocks

- Curly braces `{}` introduce **compile-time code regions**.
- These blocks are **parsed immediately** during compilation and are **never runtime objects**.
- They are used by combinators like `IF`, `map`, `filter`, `reduce`, and `switch`.

Blocks **do not** create new stack frames or capture external environments.  
They are simple structured groupings of code.

---

### 2.3 Colon Functions are the Only True Functions

Functions in Tacit are defined using the traditional FORTH colon syntax:

```tacit
: function-name ( stack-signature )
  code
;
```

Colon functions execute immediately when called.  
There is **no deferred behavior** unless explicitly deferred using a tick `'`.

---

### 2.4 Tick `'` Defers Function Invocation

Tacit allows you to defer the execution of a colon function  
using the **tick operator `'`**.

Example:

```tacit
'square map
```

Here, `'square` pushes a pointer to the `square` function onto the stack,  
instead of executing it immediately.

Tick is necessary when passing functions as arguments to combinators like `map` or `reduce`, if not using inline `{}` blocks.

---

### 2.5 No Anonymous Runtime Blocks

Tacit does **not** support parentheses `()` for creating anonymous runtime functions.  
This design avoids closure capture issues and simplifies memory management.

Anonymous inline behavior is handled **only through `{}` blocks** at compile-time,  
inside combinators that control when and how the blocks execute.

---

### 2.6 No Captured Environments

Blocks and colon functions operate **only** on the stack.  
They cannot reference external variables unless explicitly passed on the stack.

This keeps execution simple, stack-clean, and predictable.

---
## 3. Syntax Structures (Expanded)

Tacit's major control structures and sequence processing constructs are built around **combinators** that expect **curly-brace `{}` blocks**.

Each combinator follows a simple, predictable pattern:

```
[arguments] [combinator] { [block] } { [optional second block] }
```

Where:

- **Arguments** are evaluated first and pushed onto the stack.
- **Combinator** consumes the arguments and one or more `{}` blocks.
- **Blocks** define the deferred code to be executed under the combinator's control.

Blocks are compiled at **compile-time**, not runtime —  
they are not heap objects or closures.

---

### 3.1 Conditional Execution — `IF` Combinator

**Syntax:**

```tacit
condition IF { then-block } ELSE { else-block }
```

**Behavior:**

- Evaluates `condition`.
- If true, executes `then-block`.
- If false, executes `else-block`.

**Example:**

```tacit
x 0 > IF { "positive" print } ELSE { "non-positive" print }
```

- If `x` is greater than zero, prints `"positive"`.
- Otherwise, prints `"non-positive"`.

---

### 3.2 Mapping — `map` Combinator

**Syntax:**

```tacit
sequence map { block }
```

**Behavior:**

- Applies the `{block}` to each item in the `sequence`.
- Produces a new sequence of results.

**Example:**

```tacit
numbers map { dup * }
```

- Squares each number in the list `numbers`.

---

### 3.3 Filtering — `filter` Combinator

**Syntax:**

```tacit
sequence filter { block }
```

**Behavior:**

- Retains only items for which the `{block}` returns true.

**Example:**

```tacit
numbers filter { 0 > not }
```

- Keeps only positive numbers from `numbers`.

---

### 3.4 Reducing — `reduce` Combinator

**Syntax:**

```tacit
sequence reduce { block }
```

**Behavior:**

- Combines all items in the `sequence` into a single value by applying the `{block}`.

**Example:**

```tacit
numbers reduce { + }
```

- Adds all the numbers together.

---

### 3.5 Multi-Branching — `switch` Combinator

**Syntax:**

```tacit
value switch {
  pattern1 { block1 }
  pattern2 { block2 }
  else { default-block }
}
```

**Behavior:**

- Compares `value` against each `pattern`.
- Executes the first matching `{block}`.
- If no match is found, executes the `else` `{block}`.

**Example:**

```tacit
x switch {
  0 { "zero" print }
  1 { "one" print }
  else { "many" print }
}
```

- If `x` is `0`, prints `"zero"`.
- If `x` is `1`, prints `"one"`.
- Otherwise, prints `"many"`.

---

## 4. Grammar Rules (Expanded)

Tacit's grammar is designed to be small, strict, and predictable.  
There are a few simple but powerful rules that define all block and combinator behavior.

### 4.1 Block Structure Rules

- A `{}` block **must always** begin with `{` and end with `}`.
- `{}` blocks can be **nested** inside other `{}` blocks safely.
- There is **no runtime object** created for a block — blocks are only parsed and compiled at compile-time.
- **Parentheses `()`** for runtime anonymous functions are abolished under this model — they are no longer part of the language.

**Example:**

```tacit
x 0 > IF { "positive" print } ELSE { "negative" print }
```

Two blocks: `{ ... } { ... }`, associated with the `IF` and `ELSE` combinators.

---

### 4.2 Block Parsing and Matching

- When the parser sees `{`, it **pushes** a marker onto an internal parse stack.
- Tokens inside the block are parsed normally.
- When `}` is encountered, it **pops** the marker, signaling the end of the block.

If the parser encounters:

- `}` without a matching `{` — it throws a **mismatched block error**.
- End of input without closing all `{` — it throws an **unclosed block error**.

This ensures that all blocks are **properly delimited** and **cannot accidentally bleed across** program structure.

---

### 4.3 Combinator Block Requirements

Some combinators expect **a fixed number of `{}` blocks**:

| Combinator | Required Blocks |
|------------|-----------------|
| `IF`       | Two blocks (`{ then } ELSE { else }`) |
| `map`      | One block (`{ transform }`) |
| `filter`   | One block (`{ predicate }`) |
| `reduce`   | One block (`{ reducer }`) |
| `switch`   | One block containing multiple `{ case }` branches |

If a combinator does not receive the required number of `{}` blocks immediately after it is parsed,  
the compiler throws a **missing block error**.

---

### 4.4 Colon Functions and Tick (`'`) Behavior

- Colon functions (`:`...`;`) define named, reusable words.
- If you want to **pass** a function to a combinator without executing it,  
  you must **defer** it using the tick operator `'`.

**Example:**

```tacit
numbers map { square }
```

where `square` is a colon function:

```tacit
: square ( x -- x^2 )
  dup * ;
```

No block capture, no environment capture — only pure stack behavior.

---

### 4.5 No Capturing, No Lexical Environments

Blocks `{}` and colon functions **operate only on the stack**.  
They **cannot** capture outer variables.  
There are **no closures** or implicit references outside the current execution context.

This makes all flow explicit and robust.

---

## 5. Combinator Catalog (Expanded)

Tacit defines a small, powerful set of built-in combinators that use structured `{}` blocks.

| Combinator | Purpose | Syntax |
|------------|---------|--------|
| `IF`       | Conditional branching | `cond IF { then } ELSE { else }` |
| `map`      | Apply block to each element | `seq map { block }` |
| `filter`   | Keep elements by condition | `seq filter { block }` |
| `reduce`   | Fold sequence into one value | `seq reduce { block }` |
| `switch`   | Multi-way branching | `value switch { cases }` |

---

### 5.1 Details per Combinator

**`IF` — Conditional**

- Takes two blocks, separated by `ELSE`.
- First block executes if condition is true.
- Second block executes otherwise.

---

**`map` — Mapping Over Sequences**

- Takes one block.
- Applies block to each item, producing a new sequence.

---

**`filter` — Filtering Sequences**

- Takes one block.
- Keeps only items where block returns a truthy value.

---

**`reduce` — Reducing a Sequence**

- Takes one block.
- Applies block cumulatively across the sequence to collapse it.

---

**`switch` — Multi-Branch Dispatch**

- Takes one structured block containing multiple `{ case }` branches.
- Matches the value against cases sequentially.
- If no match is found, the `else` branch is executed.

---

### 5.2 Extending Combinators (Optional Future)

Other combinators could be added later, using the exact same `{}` grammar structure:

- `scan` — cumulative map (running totals)
- `while` — looping until a condition fails
- `each` — map-like side-effect operations

The same rules would apply: stack-first, combinator-next, block-last.

---

## 6. Module and File Structure (Expanded)

Tacit encourages organizing programs into **small, modular files** grouped by functionality.

### 6.1 File Naming

- Use **lowercase** names for files and folders.
- Use **hyphens** (`-`) to separate words in names.
- File extension: `.tacit`

**Examples:**

- `math.tacit`
- `sequences/filter.tacit`
- `analytics/analytics.tacit`

---

### 6.2 Word Naming

- Use **clear, functional names** for colon functions.
- Separate multi-word names with hyphens.

**Examples:**

- `square`
- `is-positive`
- `analyze-sum-of-squares`

---

### 6.3 Project Structure Example

```
my-tacit-project/
├── main.tacit
├── math/
│   └── math.tacit
├── sequences/
│   ├── filter.tacit
│   └── mapreduce.tacit
├── analytics/
│   └── analytics.tacit
└── utils/
    └── strings.tacit
```

- `main.tacit` is the entry point.
- Other folders group related functions.

---

### 6.4 Loading Modules

Use the `load "filename"` instruction at the start of your `main.tacit` file to bring in modules:

```tacit
load "math/math.tacit"
load "sequences/filter.tacit"
load "analytics/analytics.tacit"
```

Modules are loaded **sequentially** — no dependency resolution or import trees beyond simple load order.

---

### 6.5 Pure Stack Discipline

Every colon function should obey stack discipline:

- Inputs are taken from the stack.
- Outputs are placed back onto the stack.
- No side-channel communication (no globals, no captured environments).

This ensures that programs remain **composable**, **predictable**, and **safe**.

## 7. Example Programs (Expanded)

This section shows complete examples of Tacit programs, using the full combinator and syntax model.

Each example demonstrates:

- Stack-first argument evaluation
- Structured `{}` blocks for deferred control
- Colon functions for reusable logic
- No closures, no heap captures

---

### 7.1 Basic IF-ELSE Example

Simple branching based on a number's positivity.

```tacit
x 0 > IF
  { "positive" print }
ELSE
  { "non-positive" print }
```

- Evaluate `x 0 >`.
- If true, print `"positive"`.
- If false, print `"non-positive"`.

---

### 7.2 Map Over a Sequence

Squaring every number in a list:

```tacit
numbers
map { dup * }
```

- `numbers` is pushed onto the stack.
- `map` applies `{ dup * }` to each item.
- A new sequence of squares is returned.

---

### 7.3 Filter and Reduce

Sum all positive numbers:

```tacit
numbers
filter { 0 > not }
reduce { + }
```

- Filter keeps only positive numbers.
- Reduce adds them up.

---

### 7.4 Full Pipeline: Analyze Sum of Squares

Categorize a list based on the total of squared positives.

```tacit
: analyze-sum-of-squares ( sequence -- )
  filter { 0 > not }
  map { dup * }
  reduce { + }
  dup 100 > IF
    { "large" print }
  ELSE
    { "small" print } ;
```

Usage:

```tacit
numbers analyze-sum-of-squares
```

- Filters positives,
- Squares them,
- Sums them,
- Prints `"large"` if greater than 100, else `"small"`.

---

### 7.5 Switch Case Example

Categorize a number:

```tacit
x
switch {
  0 { "zero" print }
  1 { "one" print }
  else { "other" print }
}
```

- If `x` is `0`, print `"zero"`.
- If `x` is `1`, print `"one"`.
- Else print `"other"`.

---

### 7.6 Nested IF Inside Map

Label numbers as "small" or "large":

```tacit
numbers
map {
  dup 10 < IF
    { "small" }
  ELSE
    { "large" }
}
```

- For each number,
- If less than 10, output `"small"`,
- Otherwise, output `"large"`.

---

### 7.7 Full Program Example: Analytics on Multiple Datasets

```tacit
( Define helper words )

: square ( x -- x^2 )
  dup * ;

: is-positive ( x -- bool )
  0 > ;

( Define analysis function )

: analyze-sequence ( sequence -- )
  filter { is-positive }
  map { square }
  reduce { + }
  dup 200 > IF
    { "very large" print }
  ELSE
    { "moderate" print } ;

( Main program )

[3, -2, 5, -7, 4] analyze-sequence
[8, 9, 10] analyze-sequence
```

**Result:**

- `[3, -2, 5, -7, 4]` → `"moderate"`
- `[8, 9, 10]` → `"very large"`

---

# Key Features These Examples Demonstrate

- **Pure stack flow**: no hidden state.
- **Clean structured control**: `{}` blocks after combinators.
- **Clear logic decomposition**: colon functions (`:`...`;`).
- **No anonymous runtime functions**: no parentheses, no closures.
- **Readable and scalable**: modular structure even as programs grow.

---

## 8. Error Handling (Expanded)

Tacit’s simple and strict structure makes most errors **easy to detect early**, either at compile-time or at runtime.

The system defines a **small set of clear error types** to catch problems.

---

### 8.1 Compile-Time Errors

#### 8.1.1 Unclosed Block

**Cause:**  
- A `{` is opened but the matching `}` is missing before the end of input.

**Error Message:**  
```
Syntax Error: Unclosed block — expected '}' before end of file.
```

**Example:**

```tacit
x 0 > IF { "positive" print  { "negative" print }
```

(Missing closing `}` after `"positive" print`.)

---

#### 8.1.2 Unexpected Closing Block

**Cause:**  
- A `}` is encountered without a matching `{` having been opened.

**Error Message:**  
```
Syntax Error: Unexpected '}' without matching '{'.
```

**Example:**

```tacit
x 0 > IF "positive" print } { "negative" print }
```

(Errant `}` without an opening block.)

---

#### 8.1.3 Missing Required Blocks for Combinators

**Cause:**  
- A combinator like `IF`, `map`, `filter`, `reduce`, or `switch` expects `{}` blocks and they are missing.

**Error Message for `IF`:**  
```
Syntax Error: 'IF' requires two blocks: {then} ELSE {else}.
```

**Error Message for `map`, `filter`, or `reduce`:**  
```
Syntax Error: 'map' requires one block: {transform}.
```

---

#### 8.1.4 Mismatched Block Delimiters

**Cause:**  
- Opening a `{` but closing with `)` (which isn't allowed), or vice versa.

**Error Message:**  
```
Syntax Error: Mismatched block delimiters — expected matching '}'.
```

Blocks must always match properly.

---

### 8.2 Runtime Errors

#### 8.2.1 Stack Underflow

**Cause:**  
- A function or combinator expects more items on the stack than are available.

**Error Message:**  
```
Runtime Error: Stack underflow — insufficient arguments for operation.
```

**Example:**

Trying to `+` two numbers when there is only one number on the stack.

---

#### 8.2.2 Invalid Type for Operation

**Cause:**  
- A value of the wrong type is used in an operation.

**Error Message:**  
```
Runtime Error: Type mismatch — expected sequence, got number.
```

Example: Passing a number to `map` instead of a sequence.

---

#### 8.2.3 Pattern Match Failure in `switch`

**Cause:**  
- No matching pattern found in a `switch`, and no `else` branch provided.

**Error Message:**  
```
Runtime Error: No match found and no else branch in switch.
```

It is **recommended** to always include an `else` block.

---

## 9. Closing (Expanded)

Tacit’s new syntax and execution model achieves a careful balance between **simplicity**, **expressiveness**, and **performance**.

By:

- Removing runtime deferred blocks and closures,
- Relying purely on colon functions and structured `{}` blocks,
- Keeping a strict, simple parsing and execution model,

Tacit becomes a language that is:

- **Predictable**: every program flows from stack operations and block structure.
- **Modular**: programs are organized naturally into small, clean modules.
- **Scalable**: combinators handle sequencing and control structures without needing dynamic evaluation tricks.
- **Efficient**: no environment capture means no garbage collection pressure, no heap-complexity for control structures.
- **Readable**: `{}` clearly shows all deferred blocks at compile time, making programs visually structured and easy to follow.

This design strengthens Tacit's identity as:

> A stack-based language for modern compositional programming,  
> blending the spirit of FORTH with the functional power of pipelines — but without closures.

NOTES:

#[ .... ]# is for grouping
:[ ...]: is for dictionaries
[ ... ] is for vectors
( ... ) is for deferred blocks

{ ... } is free to use for these new blocks to be compiled , they are not thunks but are compiled inline
