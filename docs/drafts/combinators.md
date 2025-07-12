# Tacit Combinators

## Table of Contents

- [Tacit Combinators](#tacit-combinators)
  - [Table of Contents](#table-of-contents)
  - [1. Motivation and Model](#1-motivation-and-model)
    - [1.1 – Core Elements of Tacit Programs](#11--core-elements-of-tacit-programs)
  - [1.2 Implicit Composition in RPN](#12-implicit-composition-in-rpn)
  - [2. Lists as Function Collections — Fan-out](#2-lists-as-function-collections--fan-out)
    - [Why use fan-out?](#why-use-fan-out)
      - [Example 1 – Colour channels from brightness](#example-1--colour-channels-from-brightness)
      - [Example 2 – Quick numeric profile](#example-2--quick-numeric-profile)
      - [Example 3 – Boolean flags with conversion](#example-3--boolean-flags-with-conversion)
    - [Working with the result](#working-with-the-result)
  - [3. Fan-in: List of Functions to List of Results](#3-fan-in-list-of-functions-to-list-of-results)
    - [Example 1 – Field-wise record transformation](#example-1--field-wise-record-transformation)
    - [Example 2 – Preparing formatted output](#example-2--preparing-formatted-output)
    - [Example 3 – Summing multiple projections](#example-3--summing-multiple-projections)
  - [4. List Creation and Manipulation](#4-list-creation-and-manipulation)
    - [Example 1 – Temporary grouping for function application](#example-1--temporary-grouping-for-function-application)
    - [Example 2 – Grouping for transport or storage](#example-2--grouping-for-transport-or-storage)
  - [5. List Operations: Expand and Append](#5-list-operations-expand-and-append)
  - [6. List Map: Apply Function to Each Element](#6-list-map-apply-function-to-each-element)
    - [Why use list-map?](#why-use-list-map)
    - [Example 1 – Celsius to Fahrenheit list](#example-1--celsius-to-fahrenheit-list)
    - [Example 2 – Title-casing names](#example-2--title-casing-names)
    - [Example 3 – Map then Fold](#example-3--map-then-fold)
    - [Composition tips](#composition-tips)
  - [7. List Fold: Aggregating List Values](#7-list-fold-aggregating-list-values)
    - [Example 1 – Sum](#example-1--sum)
    - [Example 2 – Maximum](#example-2--maximum)
    - [Example 3 – Product with a Custom Combiner](#example-3--product-with-a-custom-combiner)
    - [Why list-fold?](#why-list-fold)
  - [8. List Reordering — list-permute](#8-list-reordering--list-permute)
    - [Example 1 – Swapping positions](#example-1--swapping-positions)
    - [Example 2 – Reversing a four-element list](#example-2--reversing-a-four-element-list)
    - [Example 3 – Moving a flag to the front](#example-3--moving-a-flag-to-the-front)
    - [Rules](#rules)
  - [9. Binary Variants (Advanced)](#9-binary-variants-advanced)
    - [Example 1 – Calculating slope with `2fanin`](#example-1--calculating-slope-with-2fanin)
    - [Example 2 – Comparing two readings with `2fanout`](#example-2--comparing-two-readings-with-2fanout)
    - [Example 3 – Pair-wise product inside one list](#example-3--pair-wise-product-inside-one-list)
  - [10. Capsules – Partially Applied Lists](#10-capsules--partially-applied-lists)
    - [10.1 What Is a Partially Applied Function?](#101-what-is-a-partially-applied-function)
    - [10.2 Capsule Mechanics](#102-capsule-mechanics)
    - [10.3 Assigning Capsules to Names](#103-assigning-capsules-to-names)
    - [10.4 Building Capsules Dynamically](#104-building-capsules-dynamically)
    - [10.5 Capsules as Function Values](#105-capsules-as-function-values)
    - [10.6 Building Capsules from Lists](#106-building-capsules-from-lists)
      - [Example](#example)
      - [Assigning and Invoking](#assigning-and-invoking)
    - [10.7 Summary](#107-summary)
  - [11. Conditional Lists and Control Combinators](#11-conditional-lists-and-control-combinators)
    - [11.1 What Is a Conditional List?](#111-what-is-a-conditional-list)
    - [11.2 The `if` Combinator](#112-the-if-combinator)
    - [11.3 The `then` Combinator](#113-the-then-combinator)
    - [11.4 The `else` Combinator](#114-the-else-combinator)
    - [11.5 The `end` Terminator](#115-the-end-terminator)
    - [11.6 One-Line If–Then–Else](#116-one-line-ifthenelse)
  - [12 Multi-Way Selection — `select / case / default / end`](#12--multi-way-selection--select--case--default--end)
    - [12.1 `select` — building the dispatch list](#121--select--building-the-dispatch-list)
    - [12.2 `case` — matching on a literal code](#122--case--matching-on-a-literal-code)
    - [12.3 `default` — the fall-through arm](#123--default--the-fall-through-arm)
    - [12.4 `end` — unwrapping the value](#124--end--unwrapping-the-value)
    - [12.5 Example](#125--example)
  - [13. Mutable Capsules](#13-mutable-capsules)
    - [14 Conclusion](#14--conclusion)

## 1. Motivation and Model

This document introduces a style of programming called **tacit programming**, also known as **point-free programming**. In this approach, functions are composed without explicitly naming or passing their arguments. Instead, data flow is implied by the structure of the composition itself.

Tacit programming offers a high level of clarity and compositional power by focusing on the relationships between operations, rather than the mechanics of moving data between them. This stands in contrast to conventional imperative programming, where function calls and variable assignments make data flow explicit.

The Tacit language builds on this tradition with a minimal, compositional syntax rooted in reverse Polish notation (RPN). Tacit programs are structured around functional composition, with an emphasis on clarity, reuse, and the avoidance of unnecessary naming or sequencing.

To support this style, the language introduces combinators—small building blocks for function construction—and list-based mechanisms for working with groups of values or functions. These tools make it possible to build complex behavior while keeping data flow implicit, local variable use minimal, and function composition central.

The following sections progressively introduce these combinators and list forms, showing how they enable a rich, expressive, and readable point-free programming model.

### 1.1 – Core Elements of Tacit Programs

Tacit programs are built from a small set of composable elements. Each plays a distinct role in point-free programming:

**Values**
Any literal or computed result—numbers, strings, lists—can appear on the stack. Values are polymorphic: they can be operated on directly, stored in variables, or passed to functions.

**Functions**
Functions are defined as named words using Tacit’s RPN syntax. They consume values from the stack and leave results. Function names are declared with `:` and invoked by name.

**Function References**
Using the `@` symbol before a function name produces a reference. This reference can be stored or passed like any other value. Crucially, when a function reference is assigned to a local variable, calling that variable _invokes_ the function:

```
-> f @neg
3 f      → -3
```

**Lists**
A list is a fixed-length collection of values grouped into a single structure. Lists can contain literals, other lists, or function references. They are used to build structured data, align arguments with functions, or define compound operations.

Together, values, function references, and lists form the expressive base of Tacit’s point-free logic. In the sections that follow, we use these elements to define combinators and structural patterns that eliminate the need for explicit naming, flow control, or argument handling.

## 1.2 Implicit Composition in RPN

Tacit’s reverse-Polish notation composes functions automatically.
When two words appear in sequence, the output of the first flows into the input of the second—no special operator required.

```
x  f  g        → g(f(x))
```

Example:

```
5  square  inc      → 26       \ inc(square(5))
```

Because composition is built into the evaluation order, Tacit encourages chaining small words into larger behaviours without intermediate names or extra syntax.

## 2. Lists as Function Collections — Fan-out

When you need several independent views of the **same** value, fan-out provides an elegant solution. This core combinator enables parallel transformations without variable assignments or duplicate computations.

The fan-out operation takes a single value and a list containing multiple unary functions (functions that accept one argument). It returns a new list containing the result of applying each function to the original value, preserving the same order.

```
5   (@square @negate @inc)   fanout
            ⇣
         (25 -5 6)
```

The three numbers now travel as a single unit, ready for any combinator that understands lists.

### Why use fan-out?

• **Parallel insight** – One measurement can be classified, converted, and validated in a single step.
• **Point-free clarity** – No temporary names or explicit routing; the structure alone states the intent.
• **Smooth composition** – The resulting list can be reduced (`sum`, `max`, `{ mul } fold`), expanded, stored, or passed downstream unchanged.

#### Example 1 – Colour channels from brightness

A scalar brightness value is fanned into weighted red, green, and blue components:

```
brightness   (@red-scale @green-scale @blue-scale)   fanout
            → (r g b)
```

The RGB triple can feed directly into a pixel renderer.

#### Example 2 – Quick numeric profile

For a single reading you want its square, its sign, and a small bias:

```
temperature   (@square @sign @add-0.1)   fanout
            → (power sign biased)
```

That list can be logged as-is or summed for a composite score:

```
temperature   (@square @sign @add-0.1) fanout   sum
```

#### Example 3 – Boolean flags with conversion

A raw Celsius value is checked against two thresholds and converted to Fahrenheit, all without breaking flow:

```
celsius   (@is-freezing @is-boiling @to-fahrenheit)   fanout
        → (false true 212)
```

Downstream logic can pick whichever element it needs.

### Working with the result

Because fan-out always returns a list, you can keep it grouped:

```
value funcs fanout   another-func
```

or unpack when necessary:

```
value funcs fanout   list-expand   …continue…
```

Together with `fanin`, `list`, and `fold`, fan-out gives Tacit its branch-and-merge power while keeping programs readable and point-free.

## 3. Fan-in: List of Functions to List of Results

While `fanout` sends one value through many functions, **fanin** performs the complementary operation: it applies a list of functions to multiple values, with each function processing its corresponding positional input. This powerful combinator enables parallel, positionally aligned transformations without intermediate variables or explicit sequencing.

Fan-in is particularly valuable when you need to process multiple inputs through different pathways but want to maintain their structural relationship in the output.

The `fanin` word takes `n` values followed by a list of `n` **unary** function references. It applies each function to the value in the same stack position and returns a list of the results.

Example:

```
1 2 3 (@inc @dec @negate) fanin   → (2 1 -3)
```

Here, `@inc` is applied to `1`, `@dec` to `2`, and `@negate` to `3`. Each transformation is unary: it operates on exactly one value.

This model is useful for transforming structured data, records, or aligned inputs, especially when each field or position requires a distinct operation.

#### Example 1 – Field-wise record transformation

Consider a record with three values: temperature in Celsius, a raw percentage, and a flag as an integer:

```
temp percent flag
(@to-fahrenheit @normalize @boolify) fanin
```

This transforms each field independently using the corresponding logic.

#### Example 2 – Preparing formatted output

You want to format `(name, age, balance)` into a printable string, but first:

```
name age balance
(@title-case @int->str @format-currency) fanin   → ("John" "35" "$120.00")
```

This can then be joined or displayed, passed to a UI renderer, or included in a report.

Fanin works well in pipelines where each item must be handled differently, and it ensures consistent structure and evaluation without needing temporary variable names or stack rearrangement. It is purely unary and expects its function list to match the arity of the incoming values.

#### Example 3 – Summing multiple projections

Let's say we want to take a value, apply a few transformations, and then sum the results. We start with the number five and pass it through a list of unary functions like `square`, `negate`, and `inc`. Then we sum the results.

```
5 (@square @negate @inc) fan-in sum
```

This applies each function to the number five:

- `square` gives twenty-five
- `negate` gives minus five
- `inc` gives six

`fan-in` collects those into a list:

```
(25 -5 6)
```

Then `sum` returns

```
26
```

## 4. List Creation and Manipulation

Lists provide a fundamental structuring mechanism in Tacit, allowing you to group related values into a single cohesive unit. These immutable collections can be passed between functions, stored in variables, or transformed as atomic entities, simplifying data management in point-free programming.

Two essential operations form the foundation of list handling:

**`make-list`** takes a number `n` and bundles the top `n` values from the stack into a list.

Example:

```
"red" "green" "blue" 3 make-list   → ("red" "green" "blue")
```

**`expand-list`** takes a list and pushes its elements back onto the stack.

Example:

```
("red" "green" "blue") expand-list   → "red" "green" "blue"
```

These words allow you to move freely between structured and flat forms. This is essential when composing with other combinators—some expect flat values, while others operate on grouped lists.

#### Example 1 – Temporary grouping for function application

```
x y z
3 make-list    → (x y z)
some-fn         → result
```

You can also expand a list just before applying a function that expects separate arguments:

```
(x y z) expand-list my-fn
```

#### Example 2 – Grouping for transport or storage

Lists are first-class values. You can create them from stack items and store them in variables, emit them from sequences, or embed them in larger structures:

```
sensor1 sensor2 sensor3 3 make-list -> reading
```

This forms a consistent pattern: when you want to operate structurally, **use a list**. When you need to work positionally, **expand it**. This principle is key to using Tacit’s combinators effectively.

## 5. List Operations: Expand and Append

Beyond basic creation and expansion, Tacit provides additional operations that enhance list flexibility and utility. These operations enable dynamic list manipulation - a crucial capability for compositional programming where data structures evolve throughout computation.

The following operations form a minimal but complete set of tools for working with lists in complex point-free patterns:

**list ( n → list )**
Creates a list by consuming `n` values from the stack (with the topmost value becoming the last element). This is the primary way to form a list from existing stack values.

**list-expand ( list → ... )**
Expands a list into its constituent values on the stack, in order. This is the inverse of `list`.

**list-append ( list value → list' )**
Appends a single value to the end of a list, returning a new list. This allows incremental construction of lists in staged pipelines.

**list-drop ( list → list' )**
Removes the last value from a list, returning a new shorter list. This is useful when peeling back layers of intermediate computation.

These operations are enough to support `fanout`, `fanin`, and other combinatorial techniques that involve bundling and unbundling values. More advanced list operations may be introduced in later sections or other documents as needed.

## 6. List Map: Apply Function to Each Element

A common pattern in functional programming is applying the same transformation to every element in a collection. In Tacit, `list-map` provides this capability for lists, enabling concise, uniform processing of list elements.

`list-map` accepts a list and a single **unary** function reference (a function that takes one argument), then applies that function to each element in the list. The operation preserves list structure and ordering while transforming the values, returning a new list of equal length containing the transformed elements.

```
(1 2 3 4)  @inc  list-map   → (2 3 4 5)
```

### Why use list-map?

• **Bulk edits** Cleanly convert units, format strings, normalise data—no loops, no indexing.
• **Point-free flow** The original list stays grouped; downstream combinators see one value, not scattered elements.
• **Composability** Feeds naturally into `fold`, `list-append`, `fanout`, or more mapping.

### Example 1 – Celsius to Fahrenheit list

```
(0 20 37 100)  @to-fahrenheit  list-map
→ (32 68 98.6 212)
```

The converted temperatures remain a tidy list, ready for display or analysis.

### Example 2 – Title-casing names

```
("alice" "bob" "charlie")  @title-case  list-map
→ ("Alice" "Bob" "Charlie")
```

This list can drop straight into a UI without extra variable handling.

### Example 3 – Map then Fold

Combine per-item scaling with a total:

```
(4 5 6)  @square  list-map   sum   → 77
```

First each element is squared, producing `(16 25 36)`.
`sum`—a variadic reducer—then collapses the list to a single total.

### Composition tips

```
values  list-map …              \ keep grouped
values  list-map  list-expand  \ unpack only when necessary
```

## 7. List Fold: Aggregating List Values

`list-fold` represents a fundamental operation in functional programming: reducing a collection to a single value through repeated application of a binary operation. This powerful combinator transforms multi-element lists into individual values by systematically combining elements.

Syntax (RPN):

```
(list) combiner  list-fold   → result
```

The operation requires a **binary** combiner function (one that takes exactly two arguments) and applies it progressively from left to right across the list's elements. Each intermediate result becomes the first argument to the next application of the combiner.

### Example 1 – Sum

```
(2 3 4 5)  add  list-fold   → 14
```

`add` is applied as `(((2 add 3) add 4) add 5)`.

### Example 2 – Maximum

```
(7 2 9 1)  max  list-fold   → 9
```

### Example 3 – Product with a Custom Combiner

```
(2 3 4)  mul  list-fold   → 24
```

### Why list-fold?

- **Consistency** Pairs naturally with `list-map`; both operate directly on lists.
- **No sequence overhead** Works in place; no conversion to a sequence source.
- **Point-free clarity** Keeps data grouped until a single summary value is needed.

With `list-map`, `list-fold`, `fanout`, and `fanin`, we now have a coherent toolkit for transforming, aggregating, and routing data—all while keeping flows tacit and explicit naming to a minimum.

## 8. List Reordering — list-permute

`list-permute` provides a powerful operation for reorganizing list elements without extracting and reassembling them. This combinator allows arbitrary reordering of list contents based on positional indices, enabling complex data restructuring operations while maintaining the point-free programming paradigm.

The operation requires two lists of the same length: a source list containing values, and an index list specifying the desired reordering. Indices in the second list are **zero-based**, with each position indicating which element from the original list should appear at that position in the result.

```
(values) (idx) list-permute   → (reordered-values)
```

### Example 1 – Swapping positions

```
(a b c)  (1 0 2) list-permute   → (b a c)
```

The index list says “take element 1 first, then 0, then 2”.

### Example 2 – Reversing a four-element list

```
(1 2 3 4)  (3 2 1 0) list-permute   → (4 3 2 1)
```

### Example 3 – Moving a flag to the front

```
(data ok?)  (1 0) list-permute   → (ok? data)
```

### Rules

• The index list must be the same length as the source list.
• Each index must be unique and within range; otherwise an error is raised.
• The result is a new list retaining the original element values and order specified by the index list.

`list-permute` provides precise, declarative control over list ordering without unpacking the data onto the stack.

## 9. Binary Variants (Advanced)

While Tacit's core combinators are designed to work with **unary** functions (functions taking one argument), many real-world operations require processing pairs of values together. For these scenarios, Tacit provides specialized binary variants of its core combinators.

These binary operation forms enable calculations like differences between pairs, computing ratios, making comparisons, or any other transformation requiring two inputs. When using these variants, each function in the list must be **binary** - capable of consuming exactly two values and producing a result.

| Word        | Stack pattern (RPN)                    | Result list                 |
| ----------- | -------------------------------------- | --------------------------- |
| `2fanout`   | `x y   (f₁ f₂ … fₙ)   2fanout`         | `(f₁ x y  f₂ x y … fₙ x y)` |
| `2fanin`    | `y₂ y₁  x₂ x₁   (f₁ f₂ … fₙ)   2fanin` | `(f₁ y₂ y₁  f₂ x₂ x₁ … )`   |
| `2list-map` | `(a₁ b₁ … aₙ bₙ)   f   2list-map`      | `(f a₁ b₁ … f aₙ bₙ)`       |

### Example 1 – Calculating slope with `2fanin`

```
y2 y1 x2 x1   (sub sub) 2fanin   → (dy dx)
```

`dy = y2 − y1`, `dx = x2 − x1`.

### Example 2 – Comparing two readings with `2fanout`

```
old new   (@sub @ratio @percent-change) 2fanout
→ (diff ratio pct)
```

### Example 3 – Pair-wise product inside one list

```
(2 3  4 5)   mul   2list-map   → (6 20)
```

Use binary variants only when the problem is naturally pair-centric. Unary forms remain the default; binary combinators belong in advanced pipelines where they keep pair-wise logic point-free and explicit-name-free.

## 10. Capsules – Partially Applied Lists

A **capsule** in Tacit is a list whose final element is a **function reference**. When evaluated, the capsule pushes all preceding elements onto the stack, then calls the final function as if it were passed those elements as arguments. The capsule acts as a **partially applied function**—it stores some arguments in advance and waits to be completed later.

### 10.1 What Is a Partially Applied Function?

A partially applied function is a function that has been “preloaded” with some of its arguments. For instance, consider the function `add`, which takes two numbers and returns their sum. If we know we always want to add `1`, we can pre-bind that first argument and create a new function that adds one to whatever argument comes next.

In Tacit, this can be done by creating a list with `1` and a function reference to `add`:

```
( 1 @add )
```

This is a capsule. When evaluated (using `eval`), it will:

1. Push `1` onto the stack,
2. Then call `add`, which consumes another argument from the stack and adds it to `1`.

Example:

```
4 ( 1 @add ) eval  →  5
```

The capsule `( 1 @add )` behaves like a reusable function: “add one to the input.”

### 10.2 Capsule Mechanics

A capsule is not a new type—it is just a list. But Tacit treats any list whose final slot is a function reference as **callable**. When `eval` is used on such a list:

1. The function reference in the last position is isolated.
2. All earlier elements in the list are pushed to the stack in order.
3. The function is called, consuming the arguments just pushed.

This mechanism supports arbitrary arity. For example:

```
( 2 3 @mul ) eval  → 6
( 2 3 4 @add3 ) eval  → 9
```

Capsules can return:

- A simple value (like a number),
- A list,
- Or even another capsule or monad, depending on the function logic.

### 10.3 Assigning Capsules to Names

Capsules can be assigned to local variables using standard `->` notation:

```
( 1 @add ) -> inc
```

Now `inc` is callable as a function:

```
4 inc  → 5
```

This is equivalent to `4 ( 1 @add ) eval`, but simpler and idiomatic.

Every time the name `inc` is used, it evaluates the capsule—pushing its captured arguments and calling the embedded function. This makes capsules effectively named partial functions.

### 10.4 Building Capsules Dynamically

Capsules can be constructed dynamically using `list-append`, which adds a new element to the end of a list:

```
( 1 ) @add list-append  →  ( 1 @add )
```

This is useful when creating capsules programmatically, or composing higher-order functions.

Capsules can also be composed:

```
( 2 @mul ) -> double
( 1 @add ) -> inc
( double inc ) @compose list-append  →  ( double inc @compose )
```

Here, `@compose` is a higher-order function that runs its arguments left-to-right: `x -> inc -> double`.

### 10.5 Capsules as Function Values

Capsules can be stored, passed, and reused like any value:

- Assigned to locals or buffer fields.
- Pushed onto stacks.
- Returned from functions.
- Used in pipelines (e.g., `map`, `then`).

They are stateless by default, unless explicitly made stateful (which is discussed elsewhere).

Tacit does **not** support implicit closure capture. All values inside a capsule must be explicitly present as list elements. This avoids hidden scope or runtime surprises.

### 10.6 Building Capsules from Lists

Any ordinary list can be turned into a callable capsule simply by appending a function reference to its end. Tacit provides the word **list-append** for exactly this purpose.

#### Example

```
(1 2) @add list-append   →   (1 2 @add)
```

Here’s what happens step by step:

1. `(1 2)` is a simple list containing the numbers 1 and 2.
2. `@add` is a reference to the built-in addition function.
3. `list-append` takes the list and the function reference and produces a new list with `@add` as its last element.
4. The result, `(1 2 @add)`, is now a capsule: when you `eval` it, Tacit will push 1 and 2 onto the stack and then call `add`.

#### Assigning and Invoking

You can assign this capsule to a local name and call it just like any other word:

```
(1 2 @add) -> sum12
3  sum12  eval   →   6
```

No new syntax is required—by convention, any list ending in a function reference is treated as a capsule.

### 10.7 Summary

- A **capsule** is a list with a function reference in its final position.
- It is evaluated using `eval`, which pushes all prior elements onto the stack and calls the function.
- Capsules act like partially applied functions and can be assigned to names for reuse.
- `list-append` allows construction of capsules from simpler lists.
- Capsules are first-class values and form the basis for higher-order and monadic behavior in Tacit.

## 11. Conditional Lists and Control Combinators

Building on capsules (Chapter 10), Tacit provides a way to drive control flow purely through lists and combinators—no special syntax, just pipeline words and code blocks. We call these **conditional lists** and the three core combinators `if`, `then`, and `else`, plus an explicit terminator `end`.

### 11.1 What Is a Conditional List?

A **conditional list** is a two-element list:

```
( value flag )
```

- **value** – any Tacit datum (number, string, list, capsule…)
- **flag** – a Boolean indicator (`0` for false, nonzero for true)

It carries its own test result alongside the data, and flows through the pipeline like any other list.

### 11.2 The `if` Combinator

**Usage:**

```
value if { predicate-block }
```

- **value** is pushed.
- `if` takes that value and the block on its right.
- It runs the block against the value (via `eval`), producing a flag.
- It yields the list `(value flag)`.

**Example:**

```
42 if { 10GT }
→  (42 1)    \ because 42 ≥ 10
```

### 11.3 The `then` Combinator

**Usage:**

```
( value flag ) then { then-block }
```

- If **flag ≠ 0** runs `then-block` on **value**,
  replacing `(value flag)` with `( result-of-block flag )`.
- If **flag = 0** leaves `(value flag)` untouched.

**Example:**

```
(42 1) then { add1 }
→  (43 1)
```

### 11.4 The `else` Combinator

**Usage:**

```
( value flag ) else { else-block }
```

- If **flag = 0** runs `else-block`,
  yielding `( result-of-block flag )`.
- If **flag ≠ 0** leaves `(value flag)` as is.

**Example:**

```
(42 0) else { mul2 }
→  (84 0)
```

### 11.5 The `end` Terminator

Tacit pipelines don’t auto-drop their final value. Use `end` to **discard** the top of stack and signal completion:

```
… then {…} else {…} end
```

Internally, `end` is an alias for `drop`, but its name makes clear you’re finishing a control flow.

### 11.6 One-Line If–Then–Else

All together in true Tacit style:

```
42 if { 10 gt } then { add1 } else { mul2 } end
```

- Tests 42 ≥ 10 → flag = 1
- Runs `add1` → 43
- Skips the `else` block
- Drops the final list, leaving **43** on the stack

If you need two lines for readability, you can break after `then {…}`:

```
42 if { 10 gt } then { add1 } else { mul2 } end
```

This model lets you express branching, conditional updates, and even `case`-style dispatch purely through lists and words—no parser extensions, no labels, just pipeline logic.

## 12 Multi-Way Selection — `select / case / default / end`

The two-way combinator `if … then … else … end` is often enough for Boolean branching, but many pipelines must choose among several alternatives.
Tacit adds a symmetrical, N-way construct that keeps the same point-free, infix style while re-using the status-list convention.

### 12.1 `select` — building the dispatch list

`select` converts an ordinary value into the status list that drives the rest of the chain.

```
value  select { block }           →  ( value  code )
```

The block receives the value and must return an integer `code`.
That integer becomes the second slot of the list, the first slot remains the original value.
If the block is empty (`{ }`) the value is simply duplicated, producing `(value value)`.
Nothing else happens at this stage; execution continues to the next word.

### 12.2 `case` — matching on a literal code

A `case` arm runs only when the list’s current code equals the literal that precedes the word.

```
k  case { block }
```

- The arm consumes the value, executes the block (net-arity 0),
  and re-emits `( result  -1 )`.
- The status code `-1` marks the list as **handled**; subsequent `case` or `default` arms see `-1` and automatically skip.

Multiple `case` arms may be chained left-to-right in a single expression.

### 12.3 `default` — the fall-through arm

```
default { block }
```

`default` is optional.
It fires only if no preceding `case` arm handled the list (the code is still non-negative).
Its block receives the value, produces a result, and returns `( result  -1 )`.

### 12.4 `end` — unwrapping the value

```
…  end   →   result
```

`end` removes the wrapper and pushes the contained value.
The status code, handled or not, is discarded.
If no arm fired and no `default` was present, the original value is returned unchanged.

### 12.5 Example

```
n  select { abs }  0 case { "zero" }  1 case { "one" }  default { "other" }  end
```

- `abs` derives a non-negative code from `n`.
- Exactly one arm supplies a string and marks the list handled.
- `end` unwraps, leaving `"zero"`, `"one"`, or `"other"` on the stack.

`select / case / default / end` completes Tacit’s conditional toolkit.
It offers concise, multi-branch dispatch without abandoning point-free style or introducing new data structures: the ordinary status-list drives every branch, and the pipeline continues with an ordinary value once `end` has done its work.

## 13. Mutable Capsules

So far, every capsule we’ve seen is pure and stateless: it holds arguments and an `apply` function, and evaluating it never changes its contents. Tacit also supports **mutable capsules**, whose final slot (commonly named `next`) **updates the list in place**. These are the bridge into the sequences world:

- A mutable capsule lives in a buffer or local variable, so it has a fixed memory address.
- When you invoke it (`eval` or by name), Tacit pushes its fields onto the stack, runs `next`, and then **rewrites** its own list slots from the updated stack values.
- Typical use case: an iterator that carries internal state (cursor, limit, step) and advances on each call.
- Because mutation is confined to the capsule’s own storage, you still get value-style copying via `dup`—forks of a mutable capsule evolve independently.

Mutable capsules let you build state machines (ranges, counters, filters) without heap objects or closures. They belong in the Sequences document for full examples, but this combinator doc now rounds out the model of capsules both pure and stateful.

### 14 Conclusion

Tacit’s combinator palette distills higher-order programming to a small set of orthogonal parts.

- **Lists** give concrete shape to data and can be reordered, folded, or split with fan-in / fan-out combinators.
- **Capsules** turn any list into an executable value; a mutable capsule adds in-place state without leaving the value model.
- **Status lists** unify flow control: the last cell is a code, the first cells are payload.
- Infix binders—`if / then / else / end` for two-way choice and `select / case / default / end` for N-way dispatch—route those lists point-free, with no extra syntax.
- Every combinator is stack-neutral and can be chained in one-line pipelines or nested freely.

With these elements Tacit offers a uniform, stack-based calculus for composition, branching, and controlled mutation. Larger constructs—iterators, retries, fallbacks, paginated sources, and sinks—are built entirely from this foundation; their full definitions live in the Sequences document, but they require no new semantics beyond what is presented here.
