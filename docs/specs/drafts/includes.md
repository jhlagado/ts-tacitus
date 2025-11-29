# Tacit Includes — Source-Level Inclusion Specification (Draft)

## Table of Contents

1. Introduction  
2. Smudging and Unsmudging  
3. Handling Circular Inclusions  
4. Recursive Descent and Input Stream Management  
5. Include Globals and Entry Points  
6. Implementation Details (Parsing, Tokenization, and File State)  
7. Example Inclusion Scenarios  
8. Circularity and Error Semantics  
9. Implementation Appendix — Immediate Word Semantics  
10. Full Worked Example  
11. Final Summary and Implementation Mandates  

---

## 1. Introduction

Tacit’s inclusion mechanism provides a way to stitch together multiple source files into a single, coherent program by expanding `include` directives at compile time. It is intentionally simple and designed to match Tacit’s Forth‑like execution model: includes are purely a **compile‑time flattening** tool, not a separate module or package language.

When an include directive is processed, the parser temporarily descends into the target file, compiles it as though its contents were present in-line, and then returns to the original file. The net effect is a single, flattened sequence of dictionary definitions, as if the contents of all included files had been concatenated in place.

This model is constrained by a few key requirements:

- The inclusion graph must be safe with respect to circular references. It must never spin into infinite recursion when files include each other.
- Each file should be included at most once; redundant work must be avoided.
- The dictionary must grow monotonically during batch compilation, while interactive REPL sessions must be able to undo failed inclusion attempts cleanly.
- The behaviour must remain compatible with Tacit’s existing dictionary and smudging model for colon definitions.

To satisfy these constraints, the include system uses **smudged globals** keyed by canonical file paths, a depth‑first recursive‑descent parser, and a simple policy for handling circular includes: re‑seeing a smudged file is treated as a no‑op, not an error. Later sections define these ideas in detail.

---

## 2. Smudging and Unsmudging

Tacit uses smudging to track which files are “in progress” during inclusion. A **smudged** entry is one whose metadata bit (the same bit used while a colon definition is open) is set to indicate that the corresponding file is currently being included.

When an `include` directive is encountered for a file whose canonical path has no existing global, the VM immediately creates a new dictionary entry:

- the entry’s **name** is the canonical path string (for example, `/lib/math/core.tac`),  
- the entry’s **value** is undefined at this point, and  
- the entry’s **meta flag** is set to mark it as smudged.

This smudged global serves two roles. First, it is a placeholder that will eventually hold the file’s entry‑point value once inclusion completes. Second, it is a guard against circularity: if inclusion code encounters the same canonical path while it is still smudged, it knows that the file is already being processed and that further inclusion should be skipped.

Unsmudging is the counterpart to this process. Once the parser reaches the end of the included file, and compilation has succeeded without errors, the implementation:

1. identifies the last dictionary entry defined while compiling that file (the “entry point”),  
2. writes an appropriate reference to that entry into the global’s value slot, and  
3. clears the smudge bit on the global to mark it as complete.

The smudged‑then‑unsmudged lifecycle thus defines a strict bracket around inclusion:

```text
smudge(global for "/path/to/file.tac")
    recursively parse and include file and its dependencies
unsmudge(global) and assign entry-point
```

If inclusion ends early due to a genuine error (syntax error, compile‑time failure, out‑of‑memory, etc.), the smudged global is **not** automatically repaired by the VM; it remains smudged and serves as a diagnostic marker. In a REPL, the host is responsible for rolling back such partial state, as described later.

---

## 3. Handling Circular Inclusions

Circular inclusion is a natural hazard in any include‑based system: file `A` may include file `B`, which includes `A` again (directly or through a longer chain). Tacit’s include model is designed to handle such cycles gracefully by treating them as benign rather than exceptional.

The key rule is:

> If an include encounters a smudged global whose name matches the canonical path of the target file, it treats that include as a **no‑op** and returns immediately.

This rule relies on the smudging mechanism described above. The first time a file is included, its global is smudged before any of its tokens are parsed. If, during parsing, another `include` directive targets the same canonical path, the lookup will find the smudged global. Rather than recursing or signalling an error, the implementation simply does nothing and resumes parsing the current file.

This approach has several benefits:

- It turns inclusion into a safe recursive‑descent graph walk, rather than a tree that must be kept cycle‑free by separate analysis.
- It matches the practical behaviour of C‑style include guards or `#pragma once`: the first inclusion does the work; subsequent inclusions are effectively ignored.
- It avoids forcing authors to reason carefully about global inclusion order: they can rely on the system to avoid multiple inclusion of the same file.

Circular inclusion is therefore not considered an error in the include specification. It is intentionally treated as a no‑op at the point where the cycle would otherwise be re‑entered.

---

## 4. Recursive Descent and Input Stream Management

Tacit’s parser operates as a **recursive‑descent driver** over token streams. When inclusion is involved, those token streams are nested: the current file may include a second file, which in turn includes a third, and so on.

When the parser sees an `include "path"` directive and concludes that the canonical path should be processed (absent global or smudged but not in the circular case), the host constructs a new tokenizer for the target file and recursively invokes the parser with this new token stream. The original parser context is suspended until the child parser finishes.

In pseudocode:

```text
parse(parentTokens):
    ...
    see 'include "child.tac"'
    parse(childTokens for "child.tac")
    ...
```

This recursive descent behaviour means that by the time control returns from `parse(childTokens)`, the entire contents of the included file have been processed and their dictionary entries emitted. The original parser then resumes exactly where it left off in the parent token stream.

Nested includes are handled uniformly: any included file can itself contain `include` directives, which cause further recursive calls. Depth‑first traversal is the natural result. Combined with smudging, this ensures that every file is included at most once, and that circular includes do not cause additional descent.

The important invariants are:

- the tokenizer and parser always operate on a single, active stream at a time,  
- switching between streams is structured (enter child, parse to EOF, return), and  
- the final effect is a flat sequence of dictionary entries in the order they would appear if all files were concatenated along the include edges.

---

## 5. Include Globals and Entry Points

For each file that participates in inclusion, Tacit creates a **global dictionary entry** keyed by that file’s canonical path. This global is smudged during inclusion and unsmudged when the file has been fully processed, as described in Section 2.

The value stored in this global after unsmudging is the file’s **entry point**. Conceptually, the entry point is the last dictionary entry defined while parsing that file. It may be:

- a colon definition (a word implemented in bytecode),  
- a constant or other value‑producing word,  
- a capsule constructor or other higher‑order value.

Assigning the entry point as “the last thing defined in the file” keeps the rule simple and mirrors the semantics of certain Forth systems where the last definition is a natural “handle” to the file’s contents. When another part of the system wants to refer to the included file, it can look up the canonical‑path global and obtain this entry point.

Note that the include mechanism itself does not define any particular calling convention for entry points. It simply records a reference to the last defined symbol; what that symbol does—and whether it is intended to be called or used as data—is up to the author of the file and to higher‑level mechanisms such as the module system.

---

## 6. Implementation Details (Parsing, Tokenization, and File State)

From an implementation standpoint, the include mechanism requires coordination between three pieces: parsing logic, tokenization, and file‑state tracking.

### 6.1 Parsing Logic and Tokenization

The parser is responsible for recognising the `include` immediate and then delegating inclusion work to the host and VM. It must:

- ensure that the token following `include` is a literal string;  
- pass that string to the host for canonicalization;  
- decide whether to recurse based on the state of the canonical‑path global; and  
- if recursion is required, construct a new tokenizer over the target file and call itself on that token stream.

Tokenization of included files does not differ from tokenization of the root file. Once the tokenizer is constructed, the parser sees the same kinds of tokens it would see if the contents had been present inline. This is what gives inclusion its “flattening” semantics.

### 6.2 Managing File States and Transitions

The VM must track, for each canonical path, whether inclusion is:

- not yet started (no global),  
- in progress (smudged global), or  
- complete (unsmudged global with entry‑point value).

Transitions between these states happen at well‑defined points:

- **Not yet started → Smudged** when a first include of that file occurs.  
- **Smudged → Complete** when the parser reaches EOF and inclusion has succeeded.  
- **Smudged → (rolled back)** only in interactive hosts that choose to undo a failed include by rewinding the dictionary.

The VM itself does not attempt to roll back on failure; it simply leaves the smudged global in place. Batch runs can safely terminate after an error. In a REPL, the host should snapshot the dictionary head (or an equivalent checkpoint) before each top‑level command, and restore it if an error occurs, thereby discarding any smudged entries and definitions created during the failed command.

This separation keeps the core VM logic straightforward while still allowing interactive environments to provide a clean editing experience.

---

## 7. Example Inclusion Scenarios

This section illustrates how the inclusion mechanism behaves in a few representative situations. The focus is on parser behaviour, smudging, and the resulting dictionary contents.

### 7.1 Simple Linear Inclusion

Consider two files: `main.tac`, which includes `utils.tac`, and `utils.tac`, which contains a few colon definitions.

1. The parser begins with `main.tac`.  
2. It encounters `include "utils.tac"`.  
3. The host computes the canonical path for `utils.tac`; the VM finds no corresponding global. It creates a smudged global named by that path.  
4. The host constructs a tokenizer for `utils.tac`, and the parser recursively descends into that file.  
5. Parsing runs to the end of `utils.tac`; helper definitions are added to the dictionary.  
6. The last dictionary entry (for example, `utils-end`) is chosen as the entry point and its reference is stored in the canonical‑path global. The smudge bit is cleared.  
7. Control returns to `main.tac`, and parsing resumes after the `include` directive.

The net effect is a flattened program where all of `utils.tac`’s definitions live in the global dictionary as though they had been inlined into `main.tac`.

### 7.2 Multiple Includes of the Same File

Now suppose `main.tac` includes `math.tac`, `math.tac` is also included by `vector.tac`, and `vector.tac` itself is included by `main.tac`. The first time `math.tac` is included, its canonical‑path global is created, smudged, and eventually unsmudged with its entry point. When `vector.tac` later includes `math.tac`, the lookup finds a complete (unsmudged) global and therefore skips inclusion. The parser does not recursively descend into `math.tac` a second time.

This produces a safe flattening of the inclusion graph. `math.tac` contributes its definitions once, and all subsequent includes are effectively no‑ops from the perspective of compilation work, while still honouring the “already included” information carried in the dictionary.

### 7.3 Circular Inclusion (A → B → A)

Consider the cycle where `A.tac` includes `B.tac`, and `B.tac` includes `A.tac`. Parsing starts with `A.tac`, encounters `include "B.tac"`, and creates a smudged global for `B.tac` before descending into it. Inside `B.tac`, the parser encounters `include "A.tac"`. At this point, the canonical path for `A.tac` is looked up in the dictionary and found to be smudged, because `A.tac` is still being processed.

By design, this situation is treated as a circular include and handled as a no‑op: the nested include of `A.tac` does not descend further, and parsing of `B.tac` simply continues from the next token. When `B.tac` reaches EOF, its global is unsmudged and updated with its entry point, control returns to `A.tac`, and `A.tac` eventually completes and unsmudges its own global. The result is a consistent flattened program with both `A` and `B` included exactly once, and no infinite recursion.

### 7.4 Shadowing Across Includes

Finally, consider shadowing behaviour. If `A.tac` includes `math.tac`, defines a word `sqrt`, and then includes `moremath.tac` which also defines `sqrt`, then the definition from `moremath.tac` will be the one visible to code compiled after that point. Definitions inside `A.tac` that were compiled before `moremath.tac` was included continue to see the earlier `sqrt`, because they already resolved to that dictionary entry.

This is exactly the same behaviour Tacit exhibits without includes: later definitions shadow earlier ones, and resolution within already‑compiled code remains stable. Inclusion does not introduce new rules here; it only affects how code is brought into the compile stream.

---

## 8. Circularity and Error Semantics

The include mechanism distinguishes between circular inclusion, which is benign and handled by the no‑op rule, and genuine errors, which must abort inclusion.

Circular inclusion arises when an `include` directive targets a file whose canonical‑path global is smudged. In that case the include is silently skipped: the implementation detects that inclusion is already in progress and returns immediately. This is not considered an error. It simply prevents redundant descent along cycles in the inclusion graph.

Other error conditions are treated as fatal for the current compilation:

- **Tokenization errors**, such as malformed tokens or unterminated strings in the included file.  
- **Parser errors**, such as undefined words or invalid syntactic forms during inclusion.  
- **Resource errors**, such as dictionary overflow or stack exhaustion triggered while processing the included file.  
- **Misuse of `include`**, such as providing a non‑string operand where a literal path is required.

When any of these occur, the VM signals an error and leaves the include global in its smudged state. In batch mode, the process may simply terminate. In a REPL, the host should roll back the dictionary to the last checkpoint, removing any new entries (including smudged globals) created during the failed command, so that the user can correct the problem and retry.

Smudge lifetime is therefore tightly constrained: smudging happens immediately before parsing a file, unsmudging happens only after successful completion, and any premature termination leaves the smudged marker in place for diagnostic purposes until the host chooses to discard it.

---

## 9. Implementation Appendix — Immediate Word Semantics

This appendix ties together the behaviour of the `include` immediate at the level of parser operations and dictionary updates.

When the parser encounters the token `include`, it immediately reads the next token and requires it to be a literal string; this is the include target. The host resolves this string to a canonical path, and the VM checks the dictionary for a global with that name. Depending on the state of that global:

1. If no global exists, the VM creates a smudged global, and the host constructs a tokenizer for the target file and recursively invokes the parser on it.  
2. If a smudged global exists, the include is treated as a circular case and is skipped; no further action is taken.  
3. If a complete global exists, the include is treated as redundant and skipped; the file is not re‑parsed.

Unlike runtime words, `include` does not emit bytecode. It affects only parser state (token stream switching) and dictionary state (creation and smudging of globals, entry‑point assignment on completion). The runtime has no direct trace of the include directive; all of its effects are baked into the compiled dictionary.

The smudging rule itself is implemented using the same metadata bit that is used for open colon definitions. There is no need for a separate payload or special value; the presence of the bit is enough to mark “in progress”.

---

## 10. Full Worked Example

To ground the specification, this section walks through a slightly larger inclusion scenario that combines multiple features: nested includes, circular avoidance, and shadowing.

Suppose we have the following files:

- `root.tac`  
- `a.tac`  
- `b.tac`  
- `common.tac`

with contents:

```tacit
# root.tac
include "a.tac"
include "b.tac"

# a.tac
include "common.tac"
:foo ... ;

# b.tac
include "common.tac"
include "a.tac"
:bar ... ;

# common.tac
:util ... ;
```

Parsing begins with `root.tac`. The first `include "a.tac"` creates and smudges a global for `a.tac`, then recursively parses `a.tac`. Inside `a.tac`, the `include "common.tac"` creates and smudges a global for `common.tac`, then parses `common.tac`, defining `util`, assigning it as the entry point for `common.tac`, and unsmudging that global. Control returns to `a.tac`, which defines `foo`, assigns it as the entry point for `a.tac`, unsmudges the `a.tac` global, and returns to `root.tac`.

Back in `root.tac`, the second `include "b.tac"` creates and smudges a global for `b.tac`, then parses `b.tac`. The first include inside `b.tac` is `include "common.tac"`. The canonical path for `common.tac` now has a complete, unsmudged global, so inclusion is skipped. The second include inside `b.tac` is `include "a.tac"`. The canonical path for `a.tac` also has a complete, unsmudged global, so this inclusion is likewise skipped; the potential cycle `root → b → a` is avoided. `b.tac` then defines `bar`, assigns it as the entry point for `b.tac`, unsmudges that global, and returns to `root.tac`, which completes normally.

The flattened dictionary now contains, in order of definition, the words from `common.tac`, `a.tac`, and `b.tac`, with `bar` shadowing nothing and both `foo` and `util` available as ordinary global words. The canonical‑path globals for all four files are present, unsmudged, and point at their respective entry points.

---

## 11. Final Summary and Implementation Mandates

The include mechanism in Tacit is intentionally straightforward: it is a compile‑time recursive‑descent expansion of `include` directives into a single, flattened program. The critical features of the design are:

- **Canonical path identity**: each file is identified by a unique canonical path string.  
- **Smudged include globals**: smudging marks files that are currently being included; unsmudging marks successful completion.  
- **Depth‑first traversal**: inclusion follows a depth‑first order over the file graph.  
- **Circular includes as no‑ops**: encountering a smudged global during inclusion simply skips the nested include.  
- **Single inclusion per file**: complete globals prevent re‑parsing of the same file.  
- **Dictionary persistence**: all definitions created during successful inclusion remain in the dictionary for the VM’s lifetime.  
- **Host‑managed rollback**: interactive hosts can restore a checkpointed dictionary state to undo failed includes.

An implementation that honours these rules will behave predictably on both simple and complex inclusion graphs, will avoid infinite recursion in the presence of cycles, and will integrate cleanly with Tacit’s existing dictionary and colon‑definition machinery. The include system does not introduce new runtime concepts; it is purely a structured way of feeding more source into the compiler at the right times.***
