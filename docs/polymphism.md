> # Implementation Status: Partially Implemented
> - Basic polymorphism (treating values as sequences): **Implemented** §2.1-2.3
> - Interface-based method resolution: **Planned** §3-4 
> - Currently requires NaN-boxing tag bit allocation for interfaces
> - Related to [sequences.md] for current sequence abstractions

**Tacit Language: Polymorphism, Robustness, and String Behavior**

This document outlines the rationale and design choices behind Tacit's use of polymorphism, its commitment to producing results rather than crashing, and its handling of strings, arrays, and functions as sequences. The guiding principle is that Tacit should encourage code that **terminates gracefully**, **produces meaningful output**, and **minimizes complexity** without sacrificing expressiveness.

---

**1. Justification for Polymorphism and Robustness**

One of Tacit's core goals is **robustness**. Rather than halting execution due to type mismatches or edge cases, Tacit strives to interpret values in the most meaningful way possible. The polymorphic model allows operations to succeed across a wide range of types by interpreting them **uniformly as sequences or functions**.

This approach reduces the number of runtime errors, encourages exploratory programming, and supports environments where stability is essential (e.g., embedded or reactive systems). Tacit code tends to **produce outputs**, not exceptions—favoring graceful degradation and clarity over strict enforcement.

---

**2. Polymorphism Model**

Tacit treats nearly every value as a **collection**, even scalars. A scalar is implicitly a sequence of one element. This uniformity simplifies core operations like:

- **Map**: applies a function to each element of a sequence, including scalars.
- **Fold** and **Scan**: reduce or accumulate values regardless of whether the input is a scalar, vector, or function output.
- **Filter**: applies masks to sequences, even if the underlying data is constant or cyclic.

This polymorphism ensures that code behaves predictably across a range of input types, without requiring special case logic or explicit coercion.

---

**3. Arrays as Functions**

Vectors (arrays) can be used directly as **functions**, particularly in mapping operations. When an array is used as a function, the input values are treated as **indices**, and the array returns the corresponding element.

- **Cyclical Indexing**: Indices are automatically wrapped using **modulo indexing**, so the array behaves like a circular buffer. This means negative and out-of-range indices loop back around:
  - Index `-1` gives the last element
  - Index `n` wraps around to `n % length`

This behavior makes arrays useful in mappings like `each`, `scan`, or sequence generation, where repeated access is expected and errors from out-of-bounds indices would be undesirable.

---

**4. Strings as Sequences, Not Arrays**

Tacit draws a sharp line between **arrays** and **strings**. Strings are explicitly *not* indexable, and cannot be treated as arrays of characters or bytes.

Instead, strings are interpreted as **sequences of Unicode code points**, where:

- They are stored as **UTF-8** internally for compactness.
- When used in a mapping context (e.g., with `each`), the string is **lazily decoded** into a sequence of **32-bit Unicode code points**.
- Invalid UTF-8 sequences are replaced with the standard **replacement character** (`U+FFFD`) unless strict decoding is requested.

This avoids confusion between bytes and characters and ensures that character-level operations are always Unicode-correct. Strings are **not subject to indexing**, but when treated as functions (e.g., mapped over index values), they use **cyclical character access**, just like arrays.

---

**5. Context Sensitivity and Type-Driven Behavior**

Tacit’s polymorphism includes **context-sensitive dispatch** based on how values are used. For example:

- **Scalars** in mapping contexts behave like constant functions.
- **Arrays** behave like cyclic lookup functions.
- **Strings** become sequences of decoded characters, or function-like mappings to their characters when indexed.
- **Dictionaries** can act like functions mapping keys to values, supporting polymorphic lookups.

This allows code to remain concise and expressive while still doing the right thing based on the shape and intent of the data.

---

**6. Functions as Sequences**

Functions themselves can be treated as **infinite sequences**—generators that emit one value at a time.

- These function-sequences must have **net arity zero**, meaning they consume and produce the same number of values (typically one input, one output).
- They are consumed lazily and can be processed by `each`, `scan`, `fold`, etc.
- **Safety mechanisms** like `take`, `limit`, or `until` are used to ensure termination and prevent infinite loops.
- A **global iteration cap** exists to prevent runaway evaluation by default. This cap can be overridden with explicit controls for advanced use cases.

This design makes Tacit suitable for working with reactive streams, lazy computation, and generative models—without sacrificing safety or stack integrity.

---

**7. Summary**

The overarching theme in Tacit's design is this: **interpret rather than reject**. By defaulting to polymorphism, cyclical behavior, and lazy evaluation, Tacit prefers to produce a valid result—even if approximate—rather than raise an error. This makes it an excellent choice for robust applications where stability and clarity are more important than strict enforcement.

Tacit doesn’t try to force all input into a rigid model. Instead, it provides a flexible system where values can be interpreted in context, and computation flows gracefully from input to output with minimal overhead and maximal clarity.
