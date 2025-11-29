# Tacit Module System — Specification Draft (Revised)

## 1. Overview and Goals

The Tacit module system is deliberately small and conservative. Its purpose is to let source files be composed into larger programs without introducing a second, heavyweight layer of configuration or metadata. Instead of a separate “module language”, Tacit relies on the constructs that already exist: words, dictionary entries, global variables, and capsules.

A module is simply a file that, when evaluated, leaves behind a **single value** that callers can rely on. The module system standardizes how such files are located, executed, cached, and re-used. It does not alter the VM’s core execution model.

A crucial design choice is that **dictionary visibility is never narrowed by modules**. Every word defined in a module file—helpers, internals, and exported logic—is added to the global dictionary and remains for the lifetime of the VM. Tacit does _not_ enforce privacy, does not forget helper symbols after import, and does not attempt dictionary compaction or cleanup. Authors can discourage use of internal names through conventions (e.g. leading underscores), but enforcement is social, not semantic. This keeps the implementation simple, deterministic, and free of garbage-collection behaviour.

The key design goals follow directly from this outlook. The surface area should remain small: there is a single primitive, the immediate word `import`, which is sufficient to express arbitrarily large dependency graphs. Inclusion must be deterministic and idempotent: each canonical file path is evaluated at most once, and later imports never re-run top-level code. Exports are capsule‑first: a module’s returned value, commonly a capsule, is treated as its public surface. Encapsulation is conventional rather than enforced; all words still enter the dictionary, but consumers are expected to reach for the capsule interface rather than relying on helper names. Cycle detection must be fast and explicit, using smudged globals to represent imports in progress. Finally, the host and VM responsibilities must remain clearly separated—files, paths, and inclusion order are owned by the host, while execution behaviour and global bindings are owned by the VM—and interactive workflows such as a REPL must remain usable even in the face of failed imports. 

The rest of this document defines import semantics, module responsibilities, error cases, and the interactions between host and VM.

---

## 2. Import Semantics

`import` is an immediate macro. When the parser encounters it in source, it plays a dual role. At compile time it ensures that the target file has been located, compiled, executed, and that its module value has been stored in a global bound to its canonical path. At the same time it emits runtime bytecode which, when executed later, will load that global’s module value onto the data stack. Even if a module has already been loaded, each `import "<path>"` still lowers to runtime code that pushes the cached module value.

The compile‑time inclusion procedure can be described as a linear sequence. First, the host resolves the relative path (for example `"../lib/math/core.tac"`) to a canonical absolute path. Canonicalization must guarantee that all ways of referring to the same file reduce to a single, stable string. Next, the VM checks its dictionary for a global whose name is exactly this canonical path. That global may be absent (the module has never been imported), present and smudged (an import is currently underway), or present and complete.

If a complete global is found, inclusion is already satisfied: there is no need to re‑parse or re‑evaluate the file, and the cached module value will be reused. The immediate still emits runtime code so that the cached value can be pushed at execution time. If no such global exists, the VM creates one immediately, using the canonical path as its name and marking it smudged to signal “work in progress”. With that placeholder in place, the host reads the target file, tokenizes it, and feeds its tokens into the Tacit parser and compiler. The imported file may itself contain further `import` calls, and this process recurses as needed.

Once compilation of the module file is complete, the export contract is enforced. The system invokes the file’s `main` definition—by convention the last colon definition—and verifies that between its entry and exit the data stack has grown by exactly one value. The single value left behind is taken to be the module’s result. That value is stored into the previously smudged global, and the smudge bit is cleared; the module is now fully resolved.

### Circularity detection

If, during this process, an import encounters a smudged global with the same canonical path, it raises a circular import error rather than recursing further. The partially constructed global is left in its smudged state so that diagnostics can see that work was in progress when the cycle was detected.

### Runtime lowering

Every `import "<path>"` lowers to bytecode which loads the global named by the canonical path and pushes its value. Import therefore behaves like a constant expression.

---

## 3. Idempotence, Smudging, and Circularity

Idempotence is achieved by using the canonical path as the module’s identity key. A module is only compiled once:

on the first import of a path, the VM creates a smudged global, compiles the file, runs `main`, and records the resulting value; on later imports of that path, it finds the completed global, skips compilation entirely, and simply pushes the cached value at runtime. Smudging provides safety during recursion: encountering a smudged global for the same canonical path during inclusion is treated as a circular import and reported as an error, while encountering a completed global leads to re‑use of the existing value. An absent global always triggers creation of a new smudged placeholder and the start of compilation.

### Failure handling (VM semantics)

If an error occurs during:

- parsing the module,
- evaluating top-level forms,
- running `main`,
- verifying arity,

then import fails and the VM signals an error. **The VM does not repair the dictionary.** The smudged global and any helper definitions produced so far remain in place.

### Failure handling (REPL host semantics)

An interactive REPL must not allow partially smudged modules to poison the dictionary. A simple strategy is to record a dictionary checkpoint before executing each top‑level command. If the command completes successfully, that checkpoint can be discarded. If the command fails, the host rewinds the dictionary to the checkpoint, removing all entries added during the failed command, including any smudged module globals. This allows the user to correct the source and retry without restarting the VM. Batch execution (scripts) may safely terminate on error without rollback.

---

## 4. Module Export Contract

A module must return exactly one value. By convention, the last colon definition in a module is named `main`, and the import mechanism calls `main` once to obtain the module’s export. Before calling `main`, the system records the current data‑stack depth. After `main` returns it checks that the data stack has grown by exactly one element. If the depth is unchanged, the module has not produced a value and an arity error is raised. If the depth has increased by more than one, the module has produced too many values and an arity error is likewise raised. Only the case where the stack grows by exactly one element is accepted.

The value left behind is typically a capsule, but the module system does not require this. Any value may be returned, and consumers must treat it according to its tag and structure. Whatever value is produced is written into the canonical‑path global, completing the module’s export.

---

## 5. Globals and Dispatch

All colon definitions created during module compilation behave like ordinary global words. They are callable by name. Tacit does not enforce privacy; internal words remain available.

However, relying on those global words directly as a module’s API is fragile: naming collisions are easy to introduce, and refactors that rename helpers will break callers. For this reason Tacit encourages a capsule‑first pattern. A typical module defines whatever helper words it needs, then defines a capsule constructor that collects its stable API surface, and finally arranges for `main` to return an instance of that capsule. Consumers call methods via dispatch on the capsule value rather than calling helper words directly. This provides de‑facto encapsulation while still using a flat dictionary model. The privacy boundary is conventional, not enforced by the runtime.

---

## 6. Recursive Imports and Evaluation Order

Inclusion semantics are depth‑first. If a file `A` imports `B`, and `B` in turn imports `C`, then `C` is fully compiled, executed, and resolved before `B` continues, and `B` is fully resolved before `A` resumes. Side effects at the top level of a module therefore occur only once: during the first successful import of that module.

At runtime, `import` behaves like any other expression in the compiled program. The code it emits simply loads the module value from the canonical‑path global and pushes it on the stack. The same module value can be pushed many times during execution, even though the module’s top‑level code has run only once.

Circularity is handled entirely by smudging. If inclusion encounters a smudged global for a canonical path that is already being imported, it reports a circular import error and stops rather than recursing infinitely.

---

## 7. Host and VM Responsibilities

### Host (TypeScript environment)

The host is responsible for everything related to the filesystem and source management. It maps relative strings such as `"../lib/math/core.tac"` to canonical paths, reads file contents, orders inclusions, and constructs tokenizers with the correct “current file” context so that nested relative imports resolve properly. In a REPL, it also implements rollback behaviour by recording dictionary checkpoints and rewinding on error. Finally, it expands `import` as an immediate macro, coordinating with the VM to ensure that globals are created, smudged, and ultimately populated.

### VM (Tacit engine)

The VM is responsible for the execution side: it owns the dictionary entries and smudge flags, compiles and evaluates module code, calls `main` and enforces the export arity, maintains the canonical‑path global’s value, and detects circular imports by inspecting smudge state. The VM is deliberately unaware of concrete paths, files, and the filesystem; all path and inclusion logic lives entirely in the host, which communicates with the VM only through canonical path strings and dictionary operations.

---

## 8. Error Transparency

The module system emits two key classes of errors:

- **Circular import errors** — when a module recursively imports itself through any chain.
- **Export arity errors** — when `main` fails to return exactly one value.

All other errors propagate normally through the interpreter.

A circular import error indicates that inclusion has discovered a cycle in the module graph. In concrete terms, some module `A` has, directly or indirectly, attempted to re‑import itself: the import machinery sees that the canonical path for `A` already has a smudged global and refuses to continue. This is not a recoverable situation at the VM level; it is a specification error in the module graph that the host or author must correct by breaking the cycle.

An export arity error indicates that a module has not honoured the “exactly one value” contract. Either `main` failed to produce a value at all, or it left more than one value on the stack. In both cases the module is considered invalid: it cannot be safely bound to the canonical‑path global because its result is ambiguous. Reporting this error with the canonical path in the message makes it clear which file must be fixed.

### REPL behaviour

The REPL must rewind the dictionary on any error during a top-level command, guaranteeing that failed imports do not leave broken or smudged entries behind.

Batch mode may simply terminate without rewind.

---

## 9. Consumption Pattern

Typical pipeline:

1. Host imports `"root.tac"`.
2. `root.tac` imports submodules recursively; each returns one value.
3. The root module’s capsule serves as the program’s entry surface.

In other words, execution starts with a single import at the outermost layer. That import triggers any number of additional imports as the root module’s body executes, but each of those additional imports follows the same rules: compile and run once, cache the value, and re‑use it thereafter. By the time control returns to the host, the root module has a single, well‑defined value—most often a capsule that exposes the program’s operations.

Example:

```
import "math/core.tac" var m
...
m 'add dispatch
```

At compile time:

- import ensures `/lib/math/core.tac` is compiled and cached.

At runtime:

- import loads cached module value and binds it.

This example shows the two halves of `import` working together. The compile‑time half guarantees that the `"math/core.tac"` file has been pulled into the program exactly once and that a canonical‑path global now holds its exported value. The runtime half behaves like any other expression: when the VM executes the compiled code, it fetches that exported value and binds it to a local variable `m` using the ordinary `var` semantics described in the variables and globals specifications. Later code treats `m` purely as a value, using dispatch to invoke its methods without caring how the underlying module was structured.

Modules can bundle other modules by storing their capsules inside their own capsule’s fields. Tacit requires no re-export syntax; composition is value-based.

---

## 10. Summary

Tacit’s module system is intentionally minimal:

- one primitive (`import`),
- one identity key (canonical paths),
- one export rule (exactly one value).

It supports:

- deterministic inclusion,
- cycle detection,
- capsule-based APIs,
- clear host/VM separation,
- and REPL-friendly rollback.

All dictionary entries persist for the VM’s lifetime; encapsulation is provided by convention and by dispatch, not by visibility rules.

This design keeps the VM small, predictable, and compatible with both embedded and host-driven environments.

The “one primitive” rule keeps the surface area low and avoids the need for a separate module language or metadata format. Using canonical paths as identity keys ensures that modules are always referred to unambiguously, even in complex inclusion graphs. The single export rule—exactly one value—forces module authors to be explicit about what they provide, while remaining agnostic about the exact type of that value. Deterministic inclusion and cycle detection come from smudging and canonicalization; the host never has to guess whether a file has been seen before, and the VM never silently re‑executes top‑level code. Capsule‑based APIs and conventional encapsulation give authors a straightforward way to control how their modules are used without complicating the runtime. Finally, the strict separation of filesystem concerns (host) from execution concerns (VM), together with REPL‑level rollback, makes the system robust in both batch and interactive settings.
