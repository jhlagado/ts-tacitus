Tacit Module System — Specification Draft

## 1. Overview and Goals

The Tacit module system is deliberately small and conservative. Its purpose is to let source files be composed into larger programs without introducing a second, heavyweight layer of configuration or metadata. Instead of a separate “module language”, Tacit relies on the constructs that already exist: words, dictionary entries, global variables, and capsules.

From that perspective, a “module” is just a file that, when evaluated, leaves behind a single value that callers can rely on. The module system standardizes how such files are located, executed, cached, and re-used; it does not change the core execution model of the VM.

Key design goals:

- **Simple surface** – there is one primitive, the immediate word `import`, which is enough to build arbitrarily large dependency graphs.
- **Deterministic, idempotent behavior** – each canonical file path is evaluated at most once; subsequent imports do not re-run code.
- **Capsule-first exports** – modules are expected to return one value, typically a capsule, which becomes their public surface.
- **Encapsulation via dispatch** – all words still enter the global dictionary, but consumption of a module is expected to happen through its capsule.
- **Cycle detection** – in-progress imports are tracked explicitly, so circular dependencies fail fast with clear errors.
- **Host/VM split** – the TypeScript host is responsible for files and paths; the VM is responsible for execution and global bindings.

The rest of this document spells out how `import` behaves, what contracts a module must honor, and how recursive imports and error cases are handled.

## 2. Import Semantics

The `import` word is an immediate macro. When the parser encounters it in source, it does not emit runtime bytecode; instead, it orchestrates a file-level inclusion at compile time.

Conceptually, `import "<relative-path>"` proceeds as follows:

1. The host resolves the given relative path into a **canonical path**. Canonicalization is host-defined but must be stable: the same file, referenced through different relative paths, must reduce to the same canonical string. Typically this means resolving against the directory of the file currently being compiled (or the process working directory for top-level use), then normalizing `.`/`..`, symbolic links, and case rules as appropriate for the platform.

2. The VM’s dictionary is consulted for a global whose **name** is exactly this canonical path. This global, if present, is the authoritative record for the module. It may be in one of three states:
   - Absent (module has never been imported).
   - Present but **smudged** (module is currently being imported).
   - Present and complete (module has already been imported successfully).

3. If a complete global is found, the import is trivially satisfied. No file is re-parsed or re-evaluated; the previously computed module value is reused. This is what makes imports idempotent.

4. If no global exists, a new global is created immediately with the canonical path as its name. This global is marked as **smudged** in the same way colon definitions are temporarily smudged while they are under construction. The smudge indicates that an import for this path is in progress and that its final value is not yet known.

5. With the smudged global in place, the host now reads the file identified by the canonical path, feeds it into the Tacit tokenizer and parser, and compiles its contents into bytecode, using the same VM instance. This process is recursive: the imported file is free to invoke `import` again, and so on.

6. Once the end of the file is reached, the module’s export contract is enforced: the last colon definition in the file is expected to be named `main`. The host (or a small helper in the VM) invokes `main` exactly once, and verifies that, between its entry and exit, the data stack has grown by exactly one item. That single item is taken to be the module’s value.

7. The value returned from `main` is stored into the previously smudged global. At this point, the smudge bit is cleared: the module is now fully resolved, and future imports will see the cached value.

If, during step 5, another `import` is performed with the same canonical path, the dictionary lookup in step 2 will find the smudged global. Rather than recursing infinitely, the import mechanism detects this case and raises a circular import error. The partially constructed global is left smudged for diagnostics; it is not silently converted into a completed value.

## 3. Idempotence, Smudging, and Circularity

Idempotence is achieved by choosing the canonical path as the unique key by which modules are identified. Regardless of how many relative paths might point at a given file, they all normalize to the same canonical string. The first import that reaches that file creates the global and drives compilation; subsequent imports see the completed global and skip all work.

Smudging is the mechanism that makes recursive imports safe. The placeholder global is inserted into the dictionary before the file is parsed; this means that if the module imports another module which, directly or indirectly, tries to import the original again, the second import will see that “work is in progress” and can bail out. This mirrors the way colon definitions are hidden and smudged until their closing `;`.

The rules are:

- A new canonical path with no existing global: create smudged global, then parse and evaluate.
- A canonical path with a smudged global: treat as circular import and throw.
- A canonical path with a completed global: reuse the value, do not re-run code.

If an error occurs while compiling or executing a module body, the smudged global is not automatically cleaned up; it remains smudged. The surrounding test harness or host process is expected to treat that as a failure and tear down or reset the VM, rather than trying to recover an incompletely initialized module.

## 4. Module Export Contract

Modules are expected to behave like functions that return exactly one value. In practice, the convention is that the last colon definition in a module file is named `main`. The import mechanism, after compiling the file, runs `main` and checks the stack discipline around that call.

The rules are:

- Before invoking `main`, the import machinery records the current stack depth.
- It then invokes `main` in the usual way (a normal colon definition call).
- When `main` returns, the stack depth must have increased by exactly one.

If the stack has not grown at all, the module has failed to produce a value and an arity error is raised. If the stack has grown by more than one, the module has produced too many values; this is also an error. Only the case where exactly one additional value is present is accepted.

The value produced is typically a capsule that exposes the module’s public API via dispatch. However, the module system itself does not require that the value be a capsule; that is a strongly recommended convention rather than a hard rule. It is entirely possible for a module to export a plain LIST, a number, or any other value, but consumers should then treat that value as they would any other Tacit value.

Once the export value is determined, it is written into the global variable whose name is the canonical path. That global is the authoritative binding representing “this module’s result.”

## 5. Globals and Dispatch

When a module file is compiled, all of its colon definitions behave exactly like any other colon definitions: they allocate dictionary entries, each with a name and a payload. Nothing about the module system prevents those words from being called directly by name in subsequent code.

However, relying on global names as the primary integration mechanism between modules quickly leads to collisions and brittle coupling. If two modules both define a word called `map`, or if a module is refactored and helper names change, callers that depend on those names will break.

For that reason, the module system is designed with a “capsule-first” philosophy. A typical module will:

1. Define a collection of internal words that implement its behavior.
2. Define a capsule constructor that allocates any needed state and binds methods.
3. Expose that capsule constructor as `main`, so the module’s export is a fully-initialized capsule instance.

Consumers of the module then interact with it via dispatch on that capsule value. For example:

- A host imports `"math/core.tac"` and binds its canonical global `/lib/math/core.tac` into a local variable called `math`.
- Client code calls methods via `math` by placing the method symbol on the stack and using a dispatch word; the actual names of helper functions inside the module are irrelevant.

This pattern achieves two things:

- It allows internal implementation details to change without breaking callers, as long as the capsule’s dispatch surface is preserved.
- It keeps the global dictionary as a low-level mechanism for word lookup, without forcing it to be the primary namespacing mechanism for modules.

In other words, all globals exist and are callable, but the module system encourages code to treat the exported capsule as the true API surface.

## 6. Recursive Imports and Evaluation Order

Because `import` can appear inside any file, modules naturally form a directed graph: one module’s body can import another, which can import a third, and so on. The evaluation strategy is depth-first:

- When file A executes `import "B"`, the host resolves B’s canonical path, sees no prior import, smudges its global, and begins compiling B.
- If B’s body imports C, the same process repeats: canonicalize, smudge, compile C, run C’s `main`, and complete C’s global.
- Once C is complete, control returns to B, which continues compiling and eventually runs its own `main`.
- Only when B is fully imported does A resume after its original `import "B"` call.

Side effects in a file are executed in this depth-first order as well. If A contains code before the `import "B"` line, that code executes once when A is first imported. If some other file later imports A again, the completed A module is reused and the side effects are not repeated.

The smudging rules ensure that cycles are caught: if A imports B and B (directly or indirectly) imports A again, the second attempt to import A will find a smudged global and raise an error instead of recursing.

## 7. Host and VM Responsibilities

The module system deliberately draws a clear line between what the host is responsible for and what belongs to the VM:

- The **host** decides how to map a relative string like `"../lib/math/core.tac"` to a canonical path. It performs all filesystem I/O, including reading file contents. It is also responsible for constructing the correct tokenizer with knowledge of the “current file” so that relative imports work as expected.

- The **VM** knows nothing about paths or files. From its perspective, `import` is an immediate that:
  - requests the host to resolve a path,
  - looks up or creates a global with that canonical name,
  - and, when asked, runs code and manages globals and smudges.

The VM enforces the export contract (stack delta around `main`) and stores the export value into the global. The host, in turn, uses canonical paths as keys when reporting errors or when deciding which modules to import next.

## 8. Error Transparency

Two categories of error are central to the module system:

- **Circular imports** – When a smudged global is encountered for the same canonical path that is currently being imported, the system reports a circular import error. The error text should include the canonical path so that the cycle is clear in logs or diagnostics.

- **Export arity errors** – When `main` fails to produce exactly one value, the system reports an arity error for the module. Again, the canonical path should be included so it is obvious which file violated the contract.

Other errors (syntax errors, runtime exceptions inside `main`, etc.) are handled by the normal interpreter and are not special to the module system. Their interaction with smudged globals is simple: an error aborts import, and the smudged global remains incomplete.

## 9. Consumption Pattern

Putting all of this together, a typical usage looks like this:

1. At startup, the host chooses a “root” file and performs `import "<root>"`.
2. That root file may itself import other modules; the import mechanism recursively resolves and executes each, caching results keyed by canonical path.
3. The root module’s export value is usually a capsule; the host may present that capsule to the user as the “program” or may invoke particular methods on it.

From within Tacit code, a user might write:

```
import "math/core.tac"   \ compile-time: ensure /lib/math/core.tac is loaded
/lib/math/core.tac -> m  \ bind the module capsule to a shorter name
...                       \ later
m 'add dispatch          \ invoke a method on the module
```

The exact syntax for binding `/lib/math/core.tac` to a shorter name is outside the scope of this document, but the pattern illustrates the intent: import establishes a canonical global capsule, and ordinary language constructs are used to bind that value locally.

## 10. Summary

Tacit’s module system is intentionally modest: one primitive (`import`), one key (canonical paths), and one export contract (exactly one value, usually a capsule). That is enough to support deep, recursive dependency graphs, singleton module instances, encapsulated APIs via dispatch, and clear error reporting around cycles and malformed exports. The VM stays focused on execution and globals; the host shoulders all concerns about the filesystem and path resolution. Together, they provide a predictable, composable way to build larger programs out of small Tacit files.
