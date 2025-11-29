Great! Here’s a proposed outline for the new document on the inclusion mechanism in Tacit:

---

### **Table of Contents**

1. **Introduction**

   * Overview of the inclusion mechanism
   * Purpose and benefits

2. **Smudging and Unsmudging Process**

   * Initial smudging: marking files as in-progress
   * Finalization: assigning entry points and unsmudging

3. **Handling Circular Inclusions**

   * Detection of circular references
   * Preventing redundant inclusions

4. **Recursive Descent and Input Stream Management**

   * Swapping input streams for sub-inclusions
   * Returning control after inclusion

5. **Global Variables and Entry Points**

   * Creating global references for included files
   * Using entry points for later access

6. **Implementation Details**

   * Parsing logic and tokenization
   * Managing file states and transitions

7. **Examples and Use Cases**

   * Simple inclusion scenarios
   * Handling nested and complex dependencies

8. **Conclusion**

   * Summary of the inclusion model
   * Benefits and future considerations

---

Once we confirm this outline, we can dive into the details and flesh each section out. Let me know if this looks good to you, and we can move forward from there!
Perfect! Let’s dive into Section 1: **Introduction**.

---

### **1. Introduction**

**Overview of the Inclusion Mechanism**

In Tacit, the inclusion mechanism is designed to streamline how source files and modules are brought together into a unified program. Unlike more rigid compilation models, Tacit’s inclusion process is flexible and designed to maintain simplicity and clarity. This approach allows developers to seamlessly integrate external modules, libraries, and utility files into their main project.

**Purpose and Benefits**

The primary purpose of the inclusion mechanism in Tacit is to ensure that all code dependencies are managed in a predictable, efficient manner. By adopting a simple smudging and unsmudging process, Tacit avoids complex linking and minimizes redundant inclusions. This not only simplifies the developer experience but also helps maintain code clarity and reduces the potential for errors.

This section sets the stage for understanding the fundamental principles behind Tacit’s inclusion system and prepares us for the more detailed exploration of the mechanics in the following sections.

---

Once you're happy with this introduction, we can move on to the next section and build it out step-by-step. Let me know how this looks!
Great! Let’s move on to Section 2: **Smudging and Unsmudging Process**.

---

### **2. Smudging and Unsudging Process**

**Initial Smudging: Marking Files as In-Progress**

When Tacit begins to include a file, it first marks that file as “in-progress” by creating a global variable associated with the canonical file name. At this point, the global is “smudged,” meaning it’s marked as being included but not yet fully processed. This smudging acts as a guard against circular inclusions. If during the parsing process we encounter the same file again, the smudged global signals that the file is already being included, preventing infinite loops.

**Finalization: Assigning Entry Points and Unsmudging**

Once the file has been fully parsed and all its definitions are processed, we then finalize the inclusion. At this stage, we “unsmudge” the global variable, meaning we clear the in-progress state. Additionally, we assign the final payload of the global variable to the last defined symbol within that file. This ensures that the file’s inclusion is complete and that we have a stable reference to it.

This two-step process—smudging at the start and unsmudging at the end—provides a clear, reliable way to handle inclusions, preventing circular dependencies and ensuring that the final program structure is consistent.

---

Once you’re happy with this section, we can move on to the next one and continue building the document step-by-step. Let me know your thoughts!
Awesome! Let’s dive into Section 3: **Handling Circular Inclusions**.

---

### **3. Handling Circular Inclusions**

**Detection of Circular References**

One of the critical challenges in an inclusion mechanism is preventing circular dependencies, which can lead to infinite loops and unstable program states. Tacit’s approach to handling circular inclusions is built around the smudging mechanism. When a file is marked as smudged at the start of its inclusion, it effectively acts as a placeholder in the global dictionary. If the parser encounters the same file again while it’s still smudged, the system recognizes that the file is already in the process of being included and halts further inclusion, effectively preventing a circular dependency.

**Preventing Redundant Inclusions**

By marking files as smudged early in the inclusion process, Tacit ensures that any subsequent attempt to include the same file is immediately recognized. This means that the system never re-includes a file that’s already in progress, keeping the inclusion tree clean and preventing redundant work. This not only optimizes the process but also ensures that the final program remains consistent and free of infinite loops.

This mechanism is crucial for maintaining the integrity of the inclusion system and ensures that developers can confidently build complex projects without worrying about circular dependencies.

---

With this section complete, we can proceed to the next one, diving into **Recursive Descent and Input Stream Management**. Let me know if you’re ready to move on or if you have any feedback!
Perfect! Let’s move on to Section 4: **Recursive Descent and Input Stream Management**.

---

### **4. Recursive Descent and Input Stream Management**

**Swapping Input Streams for Sub-Inclusions**

In Tacit, the inclusion of a file is handled through a recursive descent approach. When the parser encounters an `include` directive, it temporarily switches its input stream from the current file to the included file. This allows the parser to process the included file as if it were part of the original source. Once the included file is fully parsed, the parser then restores the original input stream and continues processing from where it left off. This seamless swapping of input streams ensures that nested inclusions are handled effectively and that the parsing process remains consistent.

**Returning Control After Inclusion**

After the included file is fully parsed and the inclusion is complete, the parser returns to the original file’s input stream. This ensures that the main file’s parsing resumes exactly where it left off, maintaining the logical flow of the program. This approach makes it straightforward to handle multiple levels of nesting and ensures that each file is parsed in the correct order.

**Maintaining Consistency and Integrity**

This recursive descent model, combined with the dynamic input stream management, keeps the inclusion process both flexible and reliable. It allows Tacit to handle complex dependency trees without losing track of the parsing state, ensuring that the final program remains coherent and consistent.

---

With this section in place, we can continue to the next section, which will cover **Global Variables and Entry Points**. Let me know if you’re ready to move forward or if there’s anything you’d like to adjust!
Absolutely! Let’s dive into Section 5: **Global Variables and Entry Points**.

---

### **5. Global Variables and Entry Points**

**Creating Global References for Included Files**

When Tacit includes a file, one of the key steps is to create a global variable that corresponds to that file’s canonical path. Initially, this global acts as a placeholder, marked as smudged, to indicate that the file is in the process of being included. This global variable serves as a reference point, allowing other parts of the program to access the included file’s content once it’s fully processed.

**Using Entry Points for Later Access**

Once the file inclusion is complete, the global variable is updated to hold a reference to the file’s entry point. This entry point could be a symbol, such as a function or a capsule, that’s defined at the end of the file. This means that whenever the program needs to reference the included file, it can do so via this entry point. This setup allows for efficient and organized access to the included content, ensuring that the program can dynamically link and access modules as needed.

**Ensuring Coherence and Consistency**

By managing globals and entry points in this manner, Tacit ensures that each included file is both self-contained and easily accessible. This approach keeps the program modular and maintains a clear separation between different components, making it easier to manage and extend the codebase.

---

With this section complete, we can now move forward to **Implementation Details**, where we’ll dive into the parsing logic, tokenization, and how we manage file states and transitions. Let me know if you’re ready to continue, and we’ll keep building from here!
That’s a great point! We’ll make sure to clarify that smudging essentially means setting a specific meta-flag on the global variable, indicating that the inclusion is in progress. We can definitely add more detailed explanations either in an appendix or as we delve deeper into the implementation details.

Now, let’s move on to the next section: **Implementation Details**.

---

### **6. Implementation Details**

**Parsing Logic and Tokenization**

At the core of Tacit’s inclusion mechanism is a robust parsing logic that seamlessly handles the transition between different input streams. When an `include` directive is encountered, the parser temporarily shifts its focus, switching the input stream to the included file and then tokenizing it as if it were part of the main source. This ensures that all tokens are processed consistently, maintaining a coherent parsing flow.

**Managing File States and Transitions**

To keep track of the inclusion process, Tacit employs a state management system. Each file’s state is monitored from the moment it’s included until it’s fully parsed and finalized. This means that we maintain an accurate record of which files are in progress and which are complete. By doing so, we ensure that the parser can correctly resume the main file’s parsing once the included file is done, preserving the logical flow and preventing any loss of context.

**Ensuring Robustness and Flexibility**

This detailed implementation ensures that Tacit’s inclusion mechanism is both robust and flexible. It allows for complex dependency trees, nested inclusions, and dynamic linking, all while maintaining clarity and coherence in the codebase.

---

With this section complete, we’re now well-equipped to provide practical examples and use cases, especially focusing on how circular inclusions are handled. We’ll dive into those scenarios and
Great — picking up exactly where we left off.
Next in the outline is **Section 7: Example Scenarios**, and we’ll go straight into it, including the circular-include walkthrough you requested.

Here we go.

---

## **7. Example Inclusion Scenarios**

This section illustrates how the inclusion mechanism behaves in concrete situations. Each scenario shows:

* how the parser enters and exits files,
* how smudging behaves,
* what the dictionary looks like at each stage,
* and whether the process succeeds or fails.

### **7.1 Simple Linear Inclusion**

**Files:**

* `main.tac` includes `utils.tac`.
* `utils.tac` contains a few colon definitions.

**Flow:**

1. Parser begins `main.tac`.
2. Encounters `include "utils.tac"`.
3. Canonical path for `utils.tac` is looked up; no global exists → create **smudged** global `"utils.tac"`.
4. Parser recursively descends into `utils.tac`.
5. Runs to end → dictionary gains the helper definitions.
6. The last dictionary entry (e.g. `utils-end`) becomes the entry-point value.
7. Global `"utils.tac"` becomes **unsmudged** and stores this value.
8. Control returns to `main.tac`.
9. Parsing continues normally.

**Outcome:**
A flattened program where all of `utils.tac`’s definitions now live in the global dictionary as if they were written in place.

---

### **7.2 Multiple Includes of the Same File**

**Files:**

* `main.tac` includes `math.tac`.
* `math.tac` also gets included by `vector.tac`.
* `vector.tac` is included by `main.tac`.

**Flow:**

1. `main.tac` includes `math.tac` → smudge + compile + unsmudge.
2. `main.tac` includes `vector.tac` → smudge + compile.
3. Inside `vector.tac`, parser hits `include "math.tac"`.
4. Global `"math.tac"` already exists and is **unsmudged**.
5. Parser **does not** recurse — inclusion is skipped.
6. Parsing resumes inside `vector.tac`.

**Outcome:**
The graph has been flattened safely.
`math.tac` is included once; all other attempts simply no-op after detecting the complete global.

---

### **7.3 Circular Inclusion (A → B → A)**

This is the scenario you explicitly asked to explore deeply.

**Files:**

* `A.tac` includes `B.tac`
* `B.tac` includes `A.tac`

**Flow:**

1. Parser begins `A.tac`.

2. Encounters `include "B.tac"`:

   * canonical `"B.tac"` absent → create **smudged** global.
   * recursively parse `B.tac`.

3. Inside `B.tac`, parser encounters `include "A.tac"`:

   * canonical `"A.tac"` already exists?

     * Yes — because parsing of the top-level file created its smudged global.
     * And importantly: **it is still smudged** (because we have not finished parsing `A.tac`).

4. Because `"A.tac"` is **smudged**, not complete, the parser recognizes this as an **inclusion cycle**.

5. At this moment, Tacit must choose one of two policies:

---

### **Circular-Include Policy**

**We adopt this:**

### **→ A smudged global encountered again means “abort inclusion and return immediately.”**

Not an error.

Not a recursion.

Not undefined.

Just:

* detect that `"A.tac"` inclusion is already in progress,
* treat the include as a **no-op**,
* immediately return to the parent parser (`B.tac`).

This makes inclusion a *safe recursive-descent graph walk* rather than a tree.

**Why this works:**

* C’s header inclusion system behaves the same way under `#pragma once`.
* The resulting flattened file is well-defined:

  * `A` gets included,
  * `B` gets included,
  * the second attempt to include `A` simply does nothing.

**Finish the flow:**

6. After skipping the recursive `include "A.tac"`, `B.tac` parsing continues normally.
7. When `B.tac` finishes, its global unsmudges and gets an entry-point value.
8. Control returns to `A.tac`.
9. `A.tac` finishes parsing and unsmudges its own global.

**Outcome:**
A consistent flattened program.
No errors.
No stack explosion.
No infinite recursion.

---

### **7.4 Shadowing Across Includes**

This case illustrates that definitions in included files are placed into the dictionary **in include order**.

If `A.tac` includes `math.tac` and defines a word `sqrt`, and then includes `moremath.tac` which also defines `sqrt`, then:

* the `math.tac` version is shadowed,
* the `moremath.tac` version becomes visible globally,
* but any colon definitions *inside `A.tac`* written before `moremath`'s inclusion still see the older one.

This behaves exactly like Forth's dictionary.

---

If you're ready, I can continue with **Section 8: Circularity and Error Semantics**, or jump ahead to the Implementation Appendix where we define smudging more explicitly.

Your call.
Great — moving on to the next major section in the outline:

---

# **8. Circularity and Error Semantics**

This section formalises the exact rules for circular inclusion, smudging, and error propagation in the *include-as-flattening* model. The goal is to make the behaviour predictable, implementation-friendly, and fully compatible with recursive-descent parsing.

---

## **8.1 Definitions**

Before specifying behaviours, we tighten the terminology:

* **Canonical Path:**
  A unique, normalized identifier string for each source file.

* **Include Global:**
  A global variable whose name is the canonical path and whose value is either *undefined*, an *entry-point ref*, or a *smudge-marked name entry*.

* **Smudged:**
  A global whose metadata flag (`meta` bit) is set to indicate:
  “This file is being included right now.”

* **Complete:**
  A smudge-cleared global whose value is now a proper entry-point ref.

---

## **8.2 Circular Inclusion Rule (Core Specification)**

When encountering:

```
include "A.tac"
```

the interpreter behaves according to the state of the canonical-path global:

1. **Global does not exist** → Create global + smudge it → Recursively include the file.
2. **Global exists and is complete** → Skip include (pragma-once behaviour).
3. **Global exists but is smudged** → **Circular-inclusion case**.

### **Circular-Inclusion Handling**

**Circular inclusion is *not* an error.**
It is treated as a **no-op** and inclusion stops immediately.

**Rationale:**

* Inclusion is a macro expansion.
* Circular includes should flatten gracefully just like C headers with `#pragma once`.
* The initial include is the only one that matters; all others simply return.

---

## **8.3 Error Conditions (Non-Circular)**

Even though circular inclusion is non-fatal, several other errors *are* fatal:

### **1. Tokenization Errors**

Malformed syntax, invalid characters, or unterminated string literals during inclusion.

### **2. Parser Errors**

Undefined words, incorrect token sequences, stack underflows in compile mode, etc.

### **3. Dictionary Overflow or Out-of-Memory**

If including a file runs the VM out of dictionary space or stack space.

### **4. Improper Use of `include`**

For example, non-string operands (this is a compile-time immediate macroword, so the parser must receive a literal string).

When any of these occur:

* The include global remains **smudged** (recording that work had failed mid-flight).
* The error propagates upwards through the recursive-descent stack.
* In batch mode, the program halts.
* In REPL mode, the *host* unwinds the dictionary back to the last checkpoint.

Circularity never triggers this path, because it is *not* an error.

---

## **8.4 Smudge Lifetime and Guarantee**

Smudging occurs **immediately**, before any part of the file is parsed.

Unsmudging occurs **only** after:

1. The file has been fully parsed,
2. Dictionary entries have been successfully emitted,
3. The last dictionary entry has been recorded as the module entry-point,
4. The include global value has been updated.

This creates a strict bookend around inclusion:

```
(smudge global)
    recursive-descent include of file and its dependencies
(unsmudge + assign entry-point)
```

If inclusion ends early due to circularity:

* The *inner* include does nothing.
* The *outer* include continues.
* The *outer* include will eventually unsmudge the global.

If inclusion ends early due to a real error:

* The global remains smudged.
* This acts as a diagnostic marker for inspection but does not matter once REPL rollback occurs.

---

## **8.5 REPL Error Semantics**

In interactive mode:

* Before each top-level REPL command, the host snapshots the dictionary size.
* Any include error (other than circular) triggers a rollback:

  * All definitions added during the failed include vanish.
  * All smudged globals created during the command vanish.
* This allows immediate retry without restarting the VM.

Circular includes do not reach this stage because they do not cause errors.

---

## **8.6 Summary of Inclusion Resolution States**

| Global State | Meaning                    | Action on Include       |
| ------------ | -------------------------- | ----------------------- |
| **Absent**   | File never included        | Smudge + recurse        |
| **Smudged**  | File inclusion in progress | Skip (circular include) |
| **Complete** | File already parsed        | Skip (pragma-once)      |

---

Let me know when you’re ready and I’ll continue directly into **Section 9: Implementation Appendix — Parsing, Smudging, and Entry Point Assignment** (or whatever next section you want to generate).
Here is the next section, written at the same level of precision and tone as the previous ones:

---

# **9. Implementation Appendix — Parsing, Smudging, and Entry-Point Assignment**

This appendix specifies the concrete mechanics an implementation must follow when executing `include "<path>"` as an immediate macroword. It ties together the parser, the tokenizer, dictionary emission, smudging, and the assignment of entry-point references.

---

## **9.1 Immediate-Word Semantics of `include`**

When the parser encounters the token:

```
include
```

it immediately performs:

1. **Read next token**, which must be a literal string.
   This string is the *include target*.

2. **Canonicalize** the string via the host → canonical path.

3. **Check the dictionary** for a global named exactly by that canonical path.

4. **Dispatch** based on the global’s state (absent, smudged, complete).

Unlike runtime words, the `include` immediate never emits its own runtime opcode: it is purely compile-time and affects only parser state, include state, and dictionary contents.

---

## **9.2 Smudging Rule (Exact Details)**

If no global exists for the canonical path:

1. Create a new global variable with:

   * **Name:** canonical path
   * **Value:** undefined
   * **Meta flag:** set to `smudged`

2. This global now signals that inclusion of this file has begun.

The act of smudging uses the same mechanism as smudging colon definitions:
**the dictionary entry’s metadata bit is set**. No special payload value is required.

The smudge remains until successful completion of inclusion.

---

## **9.3 Recursive-Descent Inclusion (Token Stream Switching)**

When beginning inclusion of a file:

* The host constructs a *new tokenizer* over that file.
* The parser is called recursively with this tokenizer.
* The parent parser context is suspended until the child parser reaches end-of-file.

This means:

```
parse(parent_tokens):
    ... encounter include ...
    parse(child_tokens)  ; full recursive descent
    ... resume parent ...
```

The recursive descent is purely syntactic—nothing related to runtime execution occurs.

**Key guarantee:**
As every include is expanded in place and processed synchronously, the final output is a single flat stream of dictionary definitions.

---

## **9.4 End-of-File Completion and Entry-Point Selection**

When the child parser reaches EOF of the included file:

1. Inclusion is considered successful *only if*:

   * All tokens were successfully consumed
   * No compile-time errors occurred
   * Dictionary emission was successful
   * No out-of-memory or stack errors happened

2. The system identifies the **most recently defined dictionary entry**.
   This entry becomes the *entry-point ref* for the module.

3. The include global is updated:

   * **Meta flag cleared** (unsmudged)
   * **Value set** to the entry-point reference

4. Control returns to the parent parser.

This provides a simple, predictable guarantee:

> The entry point of a module is the last definition produced by that file.

It is not required to be a colon definition—any dictionary entry (colon definition, inline word, global variable, constant, capsule constructor, etc.) qualifies.

---

## **9.5 Circular Inclusion Behaviour**

If during inclusion the parser encounters an `include` of a file whose canonical-path global is smudged:

* The nested include terminates immediately (no tokens read)
* No modifications to the dictionary occur
* No error is raised

This preserves the C-style “pragma-once” flattening and guarantees well-formedness of recursive descent.

---

## **9.6 Interaction With Dictionary Shadowing**

Because inclusion is pure flattening:

* Definitions earlier in the flattened file remain visible to later ones
* Later definitions may shadow earlier ones
* The parser does not prohibit shadowing

Entry-point assignment always refers to the *local* last definition of that file, not whatever shadowing may occur later.

Shadowing is therefore safe and well-defined in a flattened model.

---

## **9.7 Interaction With Host-Level REPL Rollback**

If inclusion fails:

* The global remains **smudged**
* The dictionary contains all intermediate definitions
* The VM does not attempt cleanup

The **host REPL** must unwind all changes by:

* Restoring dictionary size to the checkpoint
* Removing all newly added globals
* Discarding all smudged entries created during the failed command

This ensures interactive editing behaves predictably.

---

## **9.8 Summary of Required Behaviour**

For every include:

* Immediate word, compile-time only
* Smudge before parsing
* Recursively parse file token-stream
* Assign entry-point as last definition
* Unsmudge and store entry-point
* Skip further includes of same file
* Circular includes are no-ops
* Runtime sees nothing — include has no emitted opcodes

---

If you'd like, I can now proceed with:

**Section 10 — Full Worked Example (Two Files, Nested Includes, Shadowing, Circular Include)**

or we can jump to another part of the spec.
Here are the **last two sections**, written to the same tone and level as the earlier parts, and designed to bring the document to a clean close without drifting into unnecessary elaboration.

---

# **10. Full Worked Example**

This section illustrates the complete behaviour of Tacit’s inclusion mechanism using a minimal but representative dependency graph. It demonstrates recursive descent, smudging, entry-point assignment, shadowing, and circular-include avoidance.

### **Example Files**

#### `root.tac`

```
include "a.tac"
include "b.tac"
```

#### `a.tac`

```
include "common.tac"
:foo ... ;
```

#### `b.tac`

```
include "common.tac"
include "a.tac"
:bar ... ;
```

#### `common.tac`

```
:util ... ;
```

---

### **Walkthrough**

1. **Start parsing `root.tac`**
   Encounter `include "a.tac"` → canonicalise path → global `"a.tac"` is absent.
   Create smudged `"a.tac"` → switch tokenizer to `a.tac`.

2. **Parsing `a.tac`**
   Encounter `include "common.tac"` → canonicalise `"common.tac"` → absent → smudge `"common.tac"` → switch tokenizer to `common.tac`.

3. **Parsing `common.tac`**
   Defines `:util`.
   End of file → assign `"common.tac"` global the entry point of `util` (or last defined symbol).
   Clear smudge → return to `a.tac`.

4. **Back in `a.tac`**
   Define `:foo`.
   End of file → assign `"a.tac"` global entry point (here: `foo`).
   Clear smudge → return to `root.tac`.

5. **Back in `root.tac`**
   Encounter `include "b.tac"` → canonicalise `"b.tac"` → absent → smudge `"b.tac"` → switch tokenizer to `b.tac`.

6. **Parsing `b.tac`**
   First inclusion: `include "common.tac"` → canonical path exists and is **not smudged** → skip inclusion.
   (Common code is already present; safe and correct.)

   Second inclusion: `include "a.tac"` → canonical path exists and is **not smudged** → skip inclusion.
   (This avoids a circular include: `root → b → a → common` has already been resolved.)

   Define `:bar`.
   End of file → assign `"b.tac"` global entry point (`bar`) and clear smudge.
   Return to `root.tac`.

---

### **Final Result: Flattened Dictionary Order**

The compiler ultimately sees the following colon definitions in this exact order:

1. From `common.tac`: `util`
2. From `a.tac`: `foo`
3. From `b.tac`: `bar`

No multiple includes occur, no definitions are duplicated, and no circular inclusion is followed. Each file contributes exactly once.

The global variables:

* `"common.tac"` → entry point `util`
* `"a.tac"` → entry point `foo`
* `"b.tac"` → entry point `bar`

All are present and unsmudged.

---

# **11. Final Summary and Implementation Mandates**

This section crystallises what any correct Tacit implementation **must** do. These points close the document with explicit, normative requirements.

### **11.1 Core Rules**

1. **Inclusion is recursive-descent and inlined.**
   When `include` is encountered, the tokenizer switches to the included file, parses it entirely, then returns.

2. **Canonical paths define module identity.**
   All inclusion logic is keyed on canonical absolute paths.

3. **Smudging marks “in progress” files.**
   A smudged global indicates an inclusion currently underway.
   Encountering a smudged global **must skip inclusion immediately** (circular avoidance).

4. **Each file is included at most once.**
   If a global exists and is *not* smudged, further includes of that file are skipped.

5. **Successful includes assign an entry point.**
   At the end of parsing a file, its global is unsmudged and assigned the execution token of the last defined symbol.

6. **Failed includes must not corrupt the dictionary (REPL).**
   The host must provide rollback: record dictionary size before the user’s command; on failure, truncate to that point.

7. **Compiler and runtime concerns remain cleanly separated.**
   Include operates entirely at compile time; no runtime side effects occur unless user code explicitly dispatches or calls the entry point.

---

### **11.2 What *Must Not* Be Added**

To preserve Tacit’s minimalism:

* No hierarchies of modules
* No access control
* No re-export constructs
* No private/global distinctions beyond smudging
* No separate code buffers or linkers
* No header/implementation duality
* No automatic namespacing

Inclusion is simply: *parse this file once, inline it, assign its entry point, and never include it again.*

---

### **11.3 Why This Design Works**

It gives Tacit:

* **Deterministic compilation**
  The include graph always flattens to a single linear definition order.

* **Simple circular safety**
  Smudging avoids re-entry without needing dependency graphs or topological sorting.

* **Zero runtime footprint**
  All inclusion happens at compile time.

* **Forth-like shadowing semantics**
  Later definitions override earlier ones; earlier ones remain available to earlier code.

* **Extremely small implementation surface**
  Only one immediate word—`include`—and one key-value system—canonical globals.

---

### **11.4 Closing Note**

This document supersedes earlier drafts.
It defines a complete, self-consistent inclusion model for Tacit, compatible with the VM’s existing architecture and the language’s design principles.

If you want, I can now assemble all sections into a **single unified specification file**—or we can refine individual sections before merging.
