Tacit Module System — Specification Draft

## 1. Overview and Design Goals

The Tacit module system enables source files to be composed into coherent programs with minimal syntax overhead and precise control over symbol exposure, file inclusion, and data encapsulation. It is designed to support:

* **Simplicity of syntax**: Modules do not require special keywords or imports per file. Instead, they rely on the existing language model: symbols, dictionary entries, global variables, and capsules.

* **Lazy and idempotent inclusion**: Files are only parsed and evaluated when explicitly imported. Importing the same file multiple times will not re-evaluate or recompile it, avoiding duplication or redefinition errors.

* **Explicit exports**: Symbols intended for reuse must be explicitly exposed through capsule methods. This encourages encapsulation and avoids polluting the global namespace.

* **Minimal runtime footprint**: Once a module is compiled, its capsule is stored in a global variable using the canonical path as the key. The module’s static content is not re-evaluated or retained unnecessarily.

* **Deterministic linking**: Each file is resolved to a unique canonical path at compile time. This ensures that inclusion is predictable and consistent across nested imports and prevents subtle bugs from path aliasing.

* **Error transparency**: Circular imports are detected and reported by marking in-progress module globals as smudged entries. This avoids infinite loops and provides clear failure modes.

* **Capsule-based modularity**: Modules return instantiated capsules as their primary export. These capsules provide a clean dispatch surface for methods and encapsulated state, forming the basis for namespacing and reuse.

* **Isolation of implementation**: While capsules may access dictionary entries, they maintain visibility into their own scope even when external symbols conflict. This encourages modular thinking and avoids global symbol collisions.

* **Host/runtime split**: Path resolution and import tracking are handled by the TypeScript host environment, while inclusion, compilation, and dictionary operations are performed within the Tacit VM.

## 2. Module Inclusion via Manifest

Tacit does not require explicit per-file import declarations within each source file. Instead, module inclusion is driven externally by a manifest or a primary source file that defines the dependency chain. The `import` word is an immediate macro that initiates the inclusion of a module by specifying its relative path.

### Import semantics

When the `import` word is encountered, it takes the following steps:

1. Resolves the given relative path into a **canonical path**, based on the file currently being compiled or, in the case of the command line, the working directory.
2. Checks the dictionary for a global variable bound to that canonical path. If found, the module has already been included and will not be recompiled.
3. If not found, it creates a placeholder global variable for that path and marks it with a smudge bit to indicate that it is in progress.
4. Recursively compiles and evaluates the contents of the file associated with that path.
5. Assumes that the last definition in the file is named `main`, which must be a capsule constructor. It invokes `main`, captures the resulting capsule, and assigns it to the global variable.
6. Clears the smudge flag, marking the global as resolved.

This approach enables lazy, recursive module inclusion with safety against cyclic dependencies.

### Manifest-driven inclusion

A typical Tacit program includes a top-level source file that acts as a manifest or root module. It issues `import` commands for any modules it depends on. These imports trigger recursive inclusion of further dependencies.

This means modules do not carry their own metadata for inclusion; inclusion order and linkage are driven externally and explicitly. This avoids the need for automatic dependency scanning or deep graph traversal.

By relying on host-level canonicalization and explicit imports, Tacit maintains clear boundaries between files and modules, and enforces strict idempotence during inclusion.

### 3. Avoiding Multiple Inclusion

Tacit modules are imported using the `import` word, which takes a relative file path and resolves it to a **canonical absolute path**. This canonical path becomes the unique key for that module within the system, ensuring that each module is imported exactly once.

The inclusion process begins by checking whether a global variable associated with the canonical path already exists. If it does, the import is complete and no further action is taken—the previously computed value (typically a capsule) is reused. This avoids repeated parsing or execution.

To handle recursive imports, **the global variable is created and marked as 'smudged' before the file is actually parsed**. Smudging marks the variable as in the process of being defined, preventing infinite loops from circular imports. If the importer encounters a smudged global variable for the same path during inclusion, it **raises a circular import error**. This mechanism mirrors the colon-definition smudging model already used in Tacit.

Importing is thus idempotent: it either reuses a cached value or executes the file exactly once. Modules that are not yet completed during inclusion are safely blocked from reentry, and their status is tracked via the dictionary’s meta flag on the name.

This strategy ensures **deterministic linking**: every file is parsed at most once, always leaves behind the same output value, and cannot be redundantly or recursively included.

### 4. Module Execution and Export Contract

Each module, once included, must **evaluate to a single value**—typically an instantiated capsule—that becomes the module’s exported result. This value is stored in a global variable named after the canonical file path and acts as the module’s **singleton instance**.

The convention is simple: the last colon definition in a module file should be named `main`. The `import` mechanism will **invoke `main` automatically** once parsing is complete. Its return value is captured and stored as the global variable associated with the module. This return is not just conventionally enforced—it can be validated by checking that the data stack has grown by exactly one item between the start and end of `main`.

Only a **single value is accepted** as the result. If `main` returns nothing or multiple items, the import process will raise an arity error. This restriction guarantees that the result can always be assigned to the global capsule variable cleanly and predictably.

Though `main` is invoked automatically during import, it's not treated specially beyond naming: it behaves like any colon definition. Modules can contain any number of helpers or internal definitions, but only `main` is executed.

This **export contract** ensures that every module behaves predictably and integrates into the larger system via a global binding that holds its result.

### 5. Global Binding of Imported Capsules

When a module is imported, its result—typically a capsule—is bound to a **global variable named by the module’s canonical file path**. This global variable acts as the **cache and identity key** for the module, ensuring two key guarantees:

First, it ensures **singleton behavior**. Any later import of the same file will find the global already defined and reuse its value, preventing re-execution and duplicate state. This preserves referential consistency across modules.

Second, it enables **dispatch-based access** to module internals. Once the capsule is globally bound, users can call methods or access fields via dispatch. For example, after importing `"math/core.tac"`, its canonical global might be `/lib/math/core.tac`, and a client module could immediately assign it locally:
`import "math/core.tac" → local-math`.

Though the global variable uses the full canonical path as its name, this doesn’t expose it in typical user workflows. Most code binds it to a more readable name upon import. Still, this global binding is the **authoritative reference** used to detect prior inclusion and resolve circularity.

Importantly, the global is **inserted into the dictionary early**, even before the module is fully parsed. This early insertion allows the system to detect **circular dependencies**. If a second import tries to access a still-smudged global (one not yet fully defined), the system will throw an error. This guarantees that module graphs are acyclic and all imports resolve deterministically.

### 6. Dispatch and Lexical Scoping Guarantees

In Tacit, imported modules are expected to return a **capsule** as their top-level value. This capsule captures the full lexical scope of the module at the time it was compiled. Once returned, the capsule is globally bound to the module’s canonical path and becomes the sole official interface for accessing the module’s functionality.

Capsules retain internal visibility into their compiled symbols—even if those symbols are later shadowed, hidden, or deleted from the dictionary. This is a key feature of Tacit’s dispatch model: because capsule methods are compiled relative to a frozen frame and dispatch map, they retain access to the variables, fields, and helper functions defined at module compile time.

This means clients of the module do not need access to internal helper words. Even if those words are marked private (or simply undefined), the capsule can still invoke them correctly. The interface is reduced to a single dispatchable value, but that value retains full authority over its own implementation space.

This model avoids namespace pollution and reinforces modular boundaries: external code does not need to rely on internal symbol availability. Instead, all interaction is expected to happen through the exported capsule using dispatch.

### 7. Circular Dependency Detection and Smudging

To prevent infinite loops and ensure deterministic behavior, the `import` mechanism in Tacit must detect and reject circular dependencies between modules. This is achieved using a **smudging mechanism**, modeled after the existing approach used for colon definitions.

When `import` is called with a relative path, the system first resolves it to a **canonical path**. It then checks whether a global variable has already been defined for that canonical path. If it exists and is marked as complete, the cached value is used. If it does not exist, a new global variable is defined immediately, using the canonical path as the symbol name—but it is **smudged** (i.e., marked as incomplete or "in definition") at the time of entry into the dictionary.

This early declaration ensures two things:

1. **Cycle detection**:
   If a subsequent import (triggered while processing the original file) encounters this same canonical path and finds the smudged definition still unresolved, the system can throw a clear **circular import error**. This avoids silent hangs or partial compilation.

2. **Safe recursion model**:
   Even though file inclusion is recursive (a file may `import` another before finishing itself), the smudged stub allows name reservation without prematurely resolving the value. This makes import resolution robust even in deeply nested module graphs.

Once the module finishes compiling and the final `main` is executed, the return value is used to **populate the previously smudged global**. At this point, the smudge bit is cleared, and the global is considered fully resolved.

This strategy guarantees that each module is only compiled once and is uniquely identified by its canonical path. It also makes circular references explicit and preventable—ideal for low-level deterministic systems like Tacit.

### 8. Notes on globals vs dispatch

All words defined in an imported module still enter the global dictionary; they are callable directly unless shadowed later. Dispatch isn’t exclusive—it is the **stable, encapsulated** way to interact with a module without relying on global naming stability or avoiding collisions.

Dispatch remains the preferred interface because:
1. It tolerates shadowing: capsule methods retain their original bindings.
2. It minimizes namespace pollution: consumers don’t need internal helpers visible globally.
3. It provides a single, idiomatic surface for module APIs.

### 9. Recursive imports (depth-first, idempotent)

- Flow: resolve relative path → canonicalize → if global exists and is complete, reuse; if absent, create smudged global → parse/execute file → run `main` → store result → clear smudge.
- Depth-first: when A imports B and B imports C, C is resolved first; on return, B completes once and A continues. Side effects before an `import` in a file run once.
- Cycle detection: if an in-progress (smudged) global for the same canonical path is encountered, raise a circular-import error; the smudged placeholder remains until the error is handled.
- Host/VM split: the host resolves paths and feeds source; the VM maintains globals and smudge state and executes `main`. Canonical paths are the unique keys across the entire import graph.
- Reentrance: a second `import` of a fully resolved module is a no-op; a second `import` during resolution is rejected.

### Conclusion

Tacit’s module system offers a minimal but powerful mechanism for composition, isolation, and reuse. By centering modules around canonical file paths, capsule instantiation, and global variable bindings, it avoids complex linking or namespacing mechanisms while preserving determinism and compositionality.

Each import is a contract: it must return exactly one value, typically a capsule, which becomes the canonical interface for that module. While all words defined in an imported file enter the global dictionary, direct access to them risks shadowing or name collision. Capsules provide a stable, scoped access point via dispatch, reinforcing modular boundaries.

This system is deliberately simple and portable. The VM remains stateless with respect to file paths or source inclusion, leaving those tasks to the host. And yet, the resulting behavior supports recursive inclusion, circularity detection, and isolated module state—making it well-suited for both scripting and long-lived program structure.
