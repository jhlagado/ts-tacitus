TACIT MODULE SYSTEM SPECIFICATION

---

TABLE OF CONTENTS

1. Overview
2. Core Design Principles
3. Import Operation and Semantics
4. Exporting Definitions
5. Dictionary Model and Temporary Scoping
6. Recursive Imports and Return Stack Handling
7. Symbol Resolution and Cleanup
8. Internal Structure of `import` and `export`
9. Interaction Between Nested Modules
10. Advantages of This Approach
11. Implementation Notes for Compiler/Interpreter
12. Reserved Keywords
13. Common Usage Patterns
14. Example Walkthroughs
15. Design Constraints and Non-Goals
16. Future Extensions and Deferred Features
17. Summary

---

1. OVERVIEW

The Tacit module system is designed to support modularity, encapsulation, and reusability without introducing runtime symbol management. Modules are compiled at load time, and all symbol resolution is performed statically. Unlike traditional scripting languages which rely on global environments or namespace hierarchies, Tacit's module system is implemented on top of its flat global dictionary, using compile-time discipline to manage visibility and scope.

Tacit uses reverse Polish notation (RPN) and a stack-based evaluation model. The module system honors this by requiring that file paths be pushed to the stack before invoking an `import` operation. Similarly, `export` is a postfix command that operates on the most recent colon definition.

---

2. CORE DESIGN PRINCIPLES

* Flat global dictionary for all symbol names
* Definitions are temporary by default unless marked otherwise
* `export` explicitly marks a symbol as permanent
* `import` automatically manages scoping and cleanup
* Nested imports are supported without polluting the outer context
* No runtime namespaces or symbol lookups
* All behavior is resolved at compile time
* All syntax conforms to RPN: arguments first, then operations

---

3. IMPORT OPERATION AND SEMANTICS

The `import` keyword is used to bring in the contents of a module file. Its usage conforms to Tacit's syntax model: the file path is pushed to the stack, followed by the `import` operation.

Example:

"math.tc" import

This triggers the following internal sequence:

* A marker is taken using the `here` operation to record the current position in the dictionary.
* This marker is pushed onto the return stack to enable nested import tracking.
* The file is loaded and compiled.
* Each colon definition within the file is marked as temporary by default.
* If a definition is followed by `export`, it is marked as permanent.
* When compilation of the file completes, the marker is popped from the return stack, and all temporary (non-exported) definitions created since that marker are removed from the dictionary.

---

4. EXPORTING DEFINITIONS

The `export` keyword is used immediately after a colon definition to mark the most recently defined word as permanent. This word will survive the sweep phase that occurs at the end of an import operation.

Syntax:

: add { + } export
: subtract { - } export
: internal-helper { drop }

Only `add` and `subtract` will remain in the dictionary after the file is imported.

There is no support for batch exporting. This is intentional. Exporting is always explicit, unambiguous, and local to each symbol.

---

5. DICTIONARY MODEL AND TEMPORARY SCOPING

The global dictionary is implemented as a linear array or list of entries. Each entry consists of:

* A symbol name
* A pointer to its compiled implementation
* A permanence flag (true or false)
* A position or sequence number for comparison

When `import` begins, the current sequence number is stored as a marker. After the import finishes, the system walks backwards through the dictionary and removes all entries created after the marker that have not been marked permanent.

This model is safe, deterministic, and supports nested inclusion without interfering with earlier or outer contexts.

---

6. RECURSIVE IMPORTS AND RETURN STACK HANDLING

Each `import` operation is responsible for its own scope and cleanup. This is managed using the return stack.

Before compiling the file, the system executes:

here >R

At the end of the file, it executes:

R> sweep-temporaries

This ensures that nested imports do not interfere with each other. Each one has its own cleanup boundary and behaves as a fully isolated unit.

There is no need for global or static variables to track import state. The return stack manages it all cleanly and recursively.

---

7. SYMBOL RESOLUTION AND CLEANUP

During the sweep phase, the dictionary is traversed in reverse order. For each entry:

* If its sequence number is greater than the marker AND it is not permanent, it is removed.
* If it is marked as permanent, it is retained.
* All permanent symbols remain in the dictionary until explicitly redefined or forgotten.

This ensures that only explicitly exported definitions persist beyond the scope of their import.

---

8. INTERNAL STRUCTURE OF `IMPORT` AND `EXPORT`

The `import` operation is not a user-defined function—it is a primitive operation recognized by the compiler or loader. Its behavior includes:

* Validating that the top of the stack is a string
* Resolving and reading the file contents
* Creating a compile-time frame via the return stack
* Compiling the contents of the file
* Sweeping temporary definitions at the end

The `export` operation is similarly a primitive. It:

* Locates the most recently defined dictionary entry
* Sets its permanence flag to true
* Errors if there is no valid prior definition

These two primitives together enforce the boundary between internal helpers and public interfaces.

---

9. INTERACTION BETWEEN NESTED MODULES

When a module (e.g., `math.tc`) imports another module (e.g., `core.tc`), it triggers a nested import operation. This nested operation:

* Creates its own marker
* Compiles the sub-file
* Sweeps unexported definitions
* Leaves exported definitions in the global dictionary

Therefore, importing `math.tc` causes both `core.tc` and `math.tc`'s exported definitions to be visible globally, but not any temporary helpers defined inside either.

This supports modular composition and reuse of submodules without leakage.

---

10. ADVANTAGES OF THIS APPROACH

* Simple to implement and reason about
* Requires no runtime symbol tracking
* Encourages disciplined module boundaries
* Eliminates name pollution without namespaces
* Allows nesting and reuse of modules
* Flat structure is ideal for embedded or constrained environments
* Exported interface is always intentional and explicit
* Compiler remains one-pass and stateless beyond the stack

---

11. IMPLEMENTATION NOTES FOR COMPILER/INTERPRETER

The compiler should maintain:

* A global dictionary as a list or array of entries
* A sequence number or position tracker to distinguish insertion order
* A way to flag dictionary entries as temporary or permanent
* The ability to push and pop positions using the return stack
* Primitives for `here`, `>R`, `R>`, and `sweep-temporaries`

`import` is equivalent to:

here >R
evaluate-file
R> sweep-temporaries

Every include is automatically scoped by this mechanism.

---

12. RESERVED KEYWORDS

* import — loads and compiles a file
* export — marks the most recent definition as permanent
* here — gets the current dictionary position
* > R / R> — push/pop a marker to/from the return stack
* sweep-temporaries — removes all non-permanent definitions since a marker

These words are essential to the module system and are reserved in all contexts.

---

13. COMMON USAGE PATTERNS

Importing a library:

"string.tc" import

Defining and exporting functions in a module:

: length { ... } export
: split { ... } export
: internal-temp { ... }         (not exported)

Reusing another module within your own:

"core.tc" import
: useful-op { core-add 1 + } export

---

14. EXAMPLE WALKTHROUGHS

A file `core.tc` might look like:

: add { + } export
: subtract { - } export
: temp1 { dup }
: temp2 { drop }

Only `add` and `subtract` will survive.

Another file `math.tc` might include `core.tc`:

"core.tc" import
: multiply { \* } export
: double { 2 \* } export

Now importing `math.tc` brings in `add`, `subtract`, `multiply`, and `double`, but none of the temporary helpers.

---

15. DESIGN CONSTRAINTS AND NON-GOALS

* No support for runtime reflection or dynamic symbol inspection
* No concept of module aliasing or renaming
* No batch export syntax
* No symbol hiding or re-exporting
* No runtime dependencies between modules

This is intentional to keep the language simple and the compiled form deterministic.

---

16. FUTURE EXTENSIONS AND DEFERRED FEATURES

* Import aliasing: "math.tc" "math" import-as (not yet supported)
* Export-as: : foo { ... } export-as "bar"
* Module metadata: versioning, docstrings, author tags
* Compiled module formats: `.tco` bytecode equivalents
* Standard library packaging and tooling support

These may be introduced later, but are outside the current system scope.

---

17. SUMMARY

Tacit's module system is a minimal, stack-based solution to modularity. It avoids global state, runtime resolution, and namespace complexity. Every file defines what it exports. Every import operation cleans up after itself. Modules can include other modules freely, and only intentional exports persist. The entire system operates through the existing stack and dictionary model, making it natural to implement and easy to reason about.
