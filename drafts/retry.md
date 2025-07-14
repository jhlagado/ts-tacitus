# Implementation Status: Future Specification
- This document outlines the planned retry architecture
- Currently Not Implemented in the codebase

**TACIT RETRY ARCHITECTURE AND EFFECT COMPOSITION MODEL**

---

**1. PURPOSE**

Tacit is being designed as a declarative, stack-based language that eliminates traditional control constructs such as conditionals (`if`, `else`) and loops (`while`, `for`). Instead, it relies on a robust **sequence-based architecture** and **composable control flow operators**, of which **retry** is a key primitive.

The retry system allows failure-handling, retries, backoff strategies, and fault tolerance to be expressed without branching logic. This supports a declarative, resilient computation pipeline.

---

**2. CORE DESIGN GOALS**

* Eliminate explicit conditionals and loop constructs.
* Replace control flow with composable, generic sequence transformations.
* Treat errors and retries as part of the dataflow.
* Allow transparent restartability of any sequence source.
* Enable the reuse of retry logic across diverse IO and computation pipelines.
* Maintain compatibility with Tacit’s cooperative multitasking model.

---

**3. CONCEPTUAL MODEL**

A **retry combinator** is a sequence transformer that takes an input sequence and returns a new sequence with retry logic wrapped around each `next` operation.

For example:

```
some-sequence retry
```

This produces a new sequence that behaves like `some-sequence`, but retries fetching each element if it encounters a transient failure.

---

**4. SEQUENCE STRUCTURE AND RESTARTABILITY**

To support retries, **sequences must be restartable**. This means any sequence must implement a `restart` operation:

* For a range sequence: `restart` resets the index to zero.
* For a map sequence: `restart` forwards the restart to its source.
* For a paginated or IO-bound sequence: `restart` must restore the original offset and state.

Restartability enables handlers like `retry` to back off and begin again from a clean state.

---

**5. ERROR HANDLING VIA TAGGED VALUES**

Sequences in Tacit yield **tagged values**, which may include:

* A success value (e.g., a number or object)
* A tagged error (e.g., `E_TIMEOUT`, `E_IOFAIL`, `E_END`)
* A composite tag like `(ERR code)` or `(VALUE v)`

These tagged results are treated as valid items in the sequence stream, allowing handlers to propagate, intercept, or transform them.

---

**6. RETRY AS A SEQUENCE WRAPPER**

The `retry` combinator wraps a sequence and monitors each call to `next`.

If `next` returns a recoverable error, the retry logic:

1. Calls `restart` on the sequence.
2. Waits (optionally) based on a **strategy sequence** (e.g., exponential backoff).
3. Tries again, up to a configured limit or until success.

If the retry limit is exceeded or an unrecoverable error occurs, the handler yields a final tagged error and halts.

---

**7. RETRY STRATEGIES AS SEQUENCES**

Backoff and timing strategies are themselves **sequences**. A retry combinator can be given a secondary input:

```
some-sequence backoff-sequence retry
```

* Each element from `backoff-sequence` is treated as a delay or condition to wait between attempts.
* Examples include `[100 200 400]`, an exponential pattern, or even infinite wait strategies with `timeout` filters.

Strategies are pluggable and reusable, modeled just like any other data stream.

---

**8. DECLARATIVE FAILURE FLOW**

Tacit avoids direct exception handling or conditionals. All control paths are modeled as values flowing through sequences.

This means a function that fails does not raise, it **yields an error-tagged value**. Retry sequences can trap and respond to these.

Further, any retry sequence can be chained with a fallback:

```
some-sequence retry fallback-sequence choose
```

Here, `choose` selects the first non-error stream.

---

**9. COMPOSITIONALITY**

All retry sequences must:

* Implement `next` and `restart`.
* Pass through success values unmodified.
* Wrap error values in a consistent form.
* Be composable with other handlers like `mask`, `map`, `fold`, or `choose`.

This enables reuse of retry logic across file IO, HTTP, database polling, or other operations without special cases.

---

**10. EXAMPLES (INFORMAL)**

**Basic retry:**

```
fetch-seq retry
```

Retries the `fetch-seq` sequence if it returns errors.

**Retry with exponential backoff:**

```
fetch-seq [100 200 400 800] retry
```

Waits between retries based on delay sequence.

**Fallback on failure:**

```
primary-source retry fallback-source choose
```

Uses `primary-source` and retries; if it fails, switches to `fallback-source`.

**Nested retry:**

```
api-fetch retry log-seq retry each
```

Both fetching and logging are retried independently.

---

**11. CONTROL VIA TAGGED VALUES**

Retry sequences do not require branching because every step is determined by the **tag** on the value returned:

* A `:value` tag continues normally.
* An `:error` tag is handled.
* An `:end` tag signals exhaustion.

This allows pipelines to be chained purely declaratively, with full error visibility and retry logic embedded in the flow.

---

**12. IMPLICATIONS FOR TACIT**

* Control logic is no longer procedural.
* Conditional retry, fallback, and alternative routing are all done through stream transformers.
* Errors are first-class data.
* State is encapsulated in sequences and reset via `restart`.

---

**13. FUTURE EXTENSIONS**

* Retry limit policies (e.g., `max-retries 5`)
* Retry with success conditions (e.g., until predicate returns true)
* Retry pipelines with full logging
* Timeout-aware retries for IO streams
* Buffer-backed sequences for replay or caching

---

**SUMMARY**

The retry system in Tacit replaces conditional error handling and loops with composable sequence wrappers. Each failure is treated as data, each retry is declared structurally, and every recovery strategy is just another sequence. This model supports a robust, declarative architecture where even complex failure and recovery logic remains pure, testable, and compositional.

