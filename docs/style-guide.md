# Tacit Style Guide

## Table of Contents
- [Tacit Style Guide](#tacit-style-guide)
  - [Table of Contents](#table-of-contents)
  - [1. Introduction to Tacit Style](#1-introduction-to-tacit-style)
  - [2. Thinking in Stack Transformations](#2-thinking-in-stack-transformations)
  - [3. Composing Pipelines](#3-composing-pipelines)
  - [4. Inline Blocks and Data-Left Operators](#4-inline-blocks-and-data-left-operators)
  - [5. Locals and Temporary Values](#5-locals-and-temporary-values)
  - [6. Naming and Refactoring](#6-naming-and-refactoring)
  - [7. Pipelines and Higher-Order Control](#7-pipelines-and-higher-order-control)
  - [8. Final Thoughts](#8-final-thoughts)

## 1. Introduction to Tacit Style

Tacit is not just a programming language—it encourages a different way of thinking. If you’ve written code in C, Python, or JavaScript, you’re likely used to naming your inputs, defining functions around those names, and building nested expressions that grow larger and more complex as you go. Tacit asks you to leave that behind.

In Tacit, the data stack carries values from one operation to the next. You don’t name arguments. You don’t declare parameters. Each word simply transforms the stack: it consumes values, pushes results, and chains into the next step. The meaning comes not from variable names or indentation, but from the precise shape of the stack as it flows through each word.

This is called **point-free programming**. You define behavior without ever stating “what the inputs are.” Instead, you define **what happens**. It can feel unfamiliar at first, but it has deep advantages: smaller, more composable functions; clearer separation of control and data; and a mental model that encourages testable, incremental construction.

Tacit style depends on this. It’s not an add-on or optional feature—it’s the core of how programs are built. So this guide exists to help you make sense of that style. It’s not about enforcing rules for their own sake. It’s about helping you write code that fits the language: short, composable, stack-aware, and readable at a glance.

Let’s walk through how to think, write, and organize programs in a way that aligns with the strengths of Tacit.

## 2. Thinking in Stack Transformations

Tacit code is shaped by the data stack. Every word—every function or operator—assumes that certain values are already on the stack, and it leaves its result there for the next word to pick up. This forces you to think less about variables and more about flow: *what’s on the stack now, and what will be there after this step?*

You might be tempted to mentally name stack values. Resist that. Instead, get used to tracking the shape of the stack—how many items, what types, and in what order. That’s all that matters. You’re not describing what something *is* but what it *does* to the stack.

Say you have three numbers on the stack, and you want to add the first two. Instead of naming them, you just write `+`. It consumes the top two and leaves one result. If you follow it with `swap`, now you’re manipulating what’s left. Each word is a tiny gear in a machine.

This mindset supports the **compositional style** Tacit encourages. You don’t build a large function all at once. You write small pieces that each do one thing well, test them, then combine them into larger behaviors. If you keep your stack transformations clean and predictable, your programs stay easy to understand.

This section is about cultivating that mental discipline. Don’t think “assign x, then call f(x).” Think “prepare the stack, then run a pipeline.” This shift is where Tacit’s style begins to show its strength.

## 3. Composing Pipelines

In Tacit, composition isn’t just a feature—it’s the backbone of the whole programming style. When you write `f g h`, you’re not calling `h` inside `g` inside `f` like in traditional code. You’re saying: run `f`, then run `g` on its result, then `h`. Each word operates on the current state of the stack and passes control forward.

This feels closer to a shell pipeline or Unix philosophy than to functional nesting. The result is a codebase made of reusable tools that chain cleanly. You don’t need a special syntax for chaining, because composition *is* the syntax.

A good pipeline in Tacit is shallow, readable, and self-contained. Instead of nesting logic or branching, you rely on sequencing and reuse. This leads naturally to a **bottom-up development model**—you write small utilities first, test them thoroughly, and gradually combine them into larger words. Each layer you add makes the next one simpler.

Because of this, naming becomes a form of abstraction. When you name a pipeline, you’re not introducing indirection—you’re packaging a transformation. This lets you break down problems into natural steps, with words that reflect the process, not the data.

So, composing pipelines isn’t just a stylistic preference. It’s the practical result of a stack-based, point-free, bottom-up language. If you try to write in a top-down or nested way, Tacit will push back. Let it. Learn to build up, one word at a time.

## 4. Inline Blocks and Data-Left Operators

Tacit encourages a style where short, readable transformations are chained in a flat, linear form. Operators like `filter` and `map` accept a code block directly to their right, introduced with a space and an opening brace. These code blocks are not closures or nested scopes—they execute inline within the current function’s context.

Here’s a basic example using inline blocks:

```
: process  1 10 range filter { 2 mod 0 = } map { dup * } collect ;
```

This line builds a pipeline: generate numbers from 1 to 9, keep the even ones, square them, and collect the result. There's no nesting or branching—each transformation appears on a single line and follows the previous one cleanly.

If you need to refer to locals inside a block, they’re available without extra syntax:

```
: process  5 -> base  1 5 range map { base + dup * } collect ;
```

Each step reads left-to-right. The logic stays shallow, code blocks are short, and every line can be scanned at a glance. This is essential in Tacit: without named parameters or nesting, short linear forms are not just preferred—they're necessary for clarity. Longer logic should be factored into separate words.

Next, we'll cover how locals and temporary storage enable this terse pipeline style without sacrificing structure.

## 5. Locals and Temporary Values

Tacit avoids deep nesting by encouraging short, named fragments of logic. But sometimes a pipeline needs a local scratch value to avoid recalculating something. Tacit supports local variables using the arrow notation, declared inline:

```
: compute  3.14 -> pi  radius dup * pi * ;
```

This defines `pi` as a local constant. Locals are always single-assignment and scoped to the current word. You don’t need to declare them at the top—they can be introduced exactly where they’re used, keeping definitions short and readable.

Used with inline blocks, this lets you build up logic gradually:

```
: adjust  100 -> scale  1 5 range map { dup scale * } collect ;
```

There’s no global state, no stack juggling, and no need for comments. The data flows clearly: left to right, word by word, with just enough local structure to keep it maintainable.

Next, we'll show how to refactor repeating patterns into reusable words that preserve the same style.

## 6. Naming and Refactoring

Tacit code grows best when small parts are given names. Instead of nesting blocks or repeating logic, you name the steps and reuse them. This keeps each definition short, testable, and focused.

Suppose you had a sequence like this:

```
: transform  1 10 range filter { even? } map { dup * } collect ;
```

You can break this into named steps:

```
: square   dup * ;
: evens    filter { even? } ;
: squares  map { square } ;

: transform  1 10 range evens squares collect ;
```

Each word does one thing. They're short, meaningful, and stack neatly. This is what point-free, bottom-up programming looks like in Tacit: small tools composed into larger ones.

Naming like this avoids unnecessary complexity. You can see the whole pipeline at once. If a step ever needs to change, it's isolated and simple to test. This kind of refactoring is encouraged and normal in Tacit.

Next, we'll show how to combine pipelines with higher-order control and branching.

## 7. Pipelines and Higher-Order Control

Tacit code often involves chaining steps together, especially when working with sequences or processing pipelines. These are built by composing words like `filter`, `map`, `group`, `join`, and `collect`. Each of these expects a block of code to the right—this block runs for each item and typically uses local variables.

Here's a simple example:

```
: is-odd      2 mod 0 != ;
: double      2 * ;

: process     1 20 range filter { is-odd } map { double } collect ;
```

The pipeline reads left to right. The data—here, numbers one to twenty—flows through filtering, mapping, and then into `collect`, which gathers the result into a vector.

Each stage is tightly scoped. Code blocks are *not* closures—they're just inline code run in the current scope. This makes everything easier to analyze, test, and reason about. There's no capture of environment, no heap allocation, and no new scope—just ordinary code with locals.

You can also write inline blocks directly:

```
: process     1 20 range filter { 2 mod 0 != } map { 2 * } collect ;
```

This reads clearly and compactly. Tacit encourages this style when the code inside the block is short and self-contained. For anything longer or reused, name it.

## 8. Final Thoughts

Tacit programming thrives on simplicity, clarity, and composition. Its style guide exists not to constrain, but to channel effort toward readable, testable, and expressive code. What may seem like rigid discipline at first—single-line words, no named arguments, point-free chaining—quickly becomes an asset, encouraging the programmer to build with intent, refine through reuse, and communicate ideas in the smallest possible unit of meaning.

Tacit is not designed for sprawling procedural code, nor for abstract, recursive acrobatics. It’s meant for constructing behavior like piping water through valves—one transformation at a time, one purpose per tool. Each definition becomes a unit of thought. Each chain of steps reflects a complete story in miniature.

So the style, like the language, is minimal, sharp-edged, and built from the bottom up. Learn to write simply. Name your words well. Favor linear flow. And over time, you’ll find that the style isn’t a burden—it’s the clearest path to understanding what your code is doing.



