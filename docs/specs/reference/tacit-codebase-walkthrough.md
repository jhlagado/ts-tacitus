# Tacit Codebase Walkthrough

This document provides a guided tour of the Tacit codebase, tracing the execution flow from the interactive REPL down to the core Virtual Machine (VM) and its opcode implementations. Use it as an orientation map when navigating the repository or explaining the runtime to new contributors.

## 1. Entry Point: The REPL (`src/lang/repl.ts`)

The journey begins in the Read–Eval–Print Loop. `startREPL()` is the front-door API used by both the CLI entry point and tests.

- **VM bootstrap** – The REPL calls `createVM()` once and keeps the same VM for the entire session so that words defined at the prompt persist.
- **Preloading files** – Optional file arguments are processed via `processFile(vm, path)` before the prompt opens. Errors mark `allFilesProcessed = false` but the REPL continues.
- **Interactive commands** – The readline loop understands three modes: `exit`, `load <path>`, and “everything else.” Arbitrary input is forwarded to `executeProgram(vm, source)`.
- **CLI handler** – `main()` parses `--no-interactive` and positional file arguments, then invokes `startREPL()`.

## 2. The Runner (`src/lang/runner.ts`)

`executeProgram(vm, code)` coordinates compilation and execution:

1. **Tokenization** – A new `Tokenizer` instance breaks the string into `Token`s (numbers, strings, words, sigils, etc.).
2. **Compilation** – `parse(vm, tokenizer)` writes bytecode into the VM’s code segment (see §3). The compiler’s `BCP` (“baseline compile pointer”) marks the start of the freshly emitted program.
3. **Execution** – `execute(vm, vm.compiler.BCP)` transfers control to the interpreter. Because the compiler resets `CP` to `BCP` unless told to preserve code, each `executeProgram` run overwrites the previous snippet unless definitions explicitly set `compiler.preserve`.

## 3. Parsing & Compilation (`src/lang/parser.ts`)

`parse()` is responsible for turning tokens into bytecode and for maintaining the compiler’s contextual state.

- **Setup & teardown** – `resetCompiler()` rewinds the compile pointer, definition tracking fields (`defBranchPos`, `defCheckpoint`, `defEntryCell`) are reset, and an optional Tacit-native compile loop may run (see §4).
- **`parseProgram()` loop** – Continually calls `tokenizer.nextToken()` until EOF, dispatching to `processToken()`. The parser distinguishes numbers, strings, symbols, special characters, bare words, and reference sigils.
- **Literal emission** – `emitOpcode()` + `emitFloat32()` or `emitUint16()` output `LiteralNumber` / `LiteralString` sequences for constants. Tagged values (e.g., strings) are allocated via the VM’s `Digest`.
- **Word resolution** (`emitWord`) – Lookups go through `core/dictionary.lookup()`. Immediate words are detected by reading the tagged payload’s metadata bit:
  - Builtin immediate opcodes call `executeImmediateOpcode`.
  - User immediates either execute their builtin Tacit word (`executeOp`) or jump into user-defined code via `runImmediateCode`.
- **Variable references** – Locals are compiled using `Op.VarRef` + `Op.Load`; globals emit `Op.GlobalRef` with offsets relative to `GLOBAL_BASE`.
- **Special forms** – `handleSpecial()` interprets parser-level punctuation (e.g., `:`, `;`, `[`, `]`, control forms) by calling helpers in `definition-system.ts`, `meta/definition-ops.ts`, and related modules.
- **Lists & selectors** – Encountering `word[` triggers `compileBracketPathAsList()` which compiles the selector list, then `Op.Select`/`Op.Load` pairs to access nested data.
- **`definition-system.ts`** – `beginDefinition()` (triggered by `:`) emits a `Branch` placeholder to skip the function body at runtime, registers the word in the dictionary, and enables `compiler.preserve` so code survives after execution. `endDefinition()` inserts `Op.Exit`, patches the branch offset, and restores dictionary metadata.
- **Final validation** – `validateFinalState()` ensures there are no unterminated definitions, conditionals, or lists, then appends an `Op.Abort` so stray execution halts cleanly.

## 4. Immediate Macros & Tacit Compile Loop (`src/lang/compile-loop.ts`)

The parser has a programmable “compile loop” that can be toggled with `TACIT_COMPILE_LOOP=1`.

- **Token streaming** – `tokenNext()` exposes the current tokenizer to Tacit code, returning `(type, raw)` pairs where `raw` is a tagged representation interned via the VM digest.
- **Tacit-side dispatcher** – `runTacitCompileLoop()` repeatedly reads tokens, pushes them onto the stack, and routes them to helper verbs (`emitNumberWord`, `emitStringWord`, `emitWordCall`, `emitRefSigilWord`, etc.). Each helper ultimately calls back into the parser to emit bytecode.
- **Handled flag** – After the Tacit loop finishes, it must push a non-zero flag indicating it consumed the input stream; otherwise `parseProgram()` runs as normal.
- **Immediate helpers** – `meta/` modules house the “immediate word” implementations (control structures, list builders, variable management). Builtins mark their dictionary payloads with `meta = 1`, letting `emitWord()` know they should run during compilation rather than be emitted as calls.

## 5. Execution (`src/lang/interpreter.ts`)

`execute(vm, start)` is the interpreter’s main loop.

- **Instruction fetch** – The interpreter reads the next raw byte from `SEG_CODE`. If the high bit is set (`0x80`), it decodes a user-defined opcode using Tacit’s X1516 format; otherwise it uses the byte as a builtin opcode.
- **Dispatch** – `nextOpcode()` hands the decoded value to `executeOp()`. For user words, `executeOp()` pushes the caller’s `IP` and `BP` onto the return stack and jumps directly to the target address. For builtins, it looks up the registered Tacit word (see §7) and executes it.
- **Execution bounds** – The loop continues while `vm.running` is true and `vm.IP < vm.compiler.CP`, ensuring it only executes the bytecode produced during the current compilation cycle.
- **Error handling** – Any exception captures `getStackData(vm)` for diagnostics, resets compiler state, clears `compiler.preserve`, and rethrows with augmented context.
- **Embedding calls** – `callTacit()` exposes a re-entrant API for calling Tacit code from JS. It saves the current frame on the return stack, sets `vm.IP` to the callee’s address, runs `execute()`, and restores state afterward.

## 6. Virtual Machine State (`src/core/vm.ts`)

The VM is a plain object passed everywhere, bundling execution, compilation, stacks, and dictionary data.

- **Core registers** – `memory`, `sp`, `rsp`, `bp`, `gp`, `IP`, and `running` manage the unified data arena, stack pointers (all in cells), instruction pointer, and allocator head. `bp` anchors stack frames in the return stack segment.
- **Compiler state** – `compiler` (from `src/lang/compiler.ts`) tracks the compile pointer (`CP`), the boundary between preserved and scratch code (`BCP`), and metadata like `reservePatchAddr`.
- **Interning & dictionary** – `digest` maps strings to indices stored as `Tag.STRING`. `head` points into the heap-backed dictionary chain where entries are stored as 3-slot lists (`prevRef`, payload, name). Flags `defBranchPos`, `defCheckpoint`, and `defEntryCell` flatten the old `ActiveDefinition` object for definition tracking.
- **Creation & caching** – `createVM()` wires memory (see §7), initializes stacks to `STACK_BASE` / `RSTACK_BASE`, registers builtins, and optionally caches a VM snapshot for tests so repeated runs share the builtin dictionary without re-registering every time.
- **Stack helpers** – `push`, `pop`, `peek`, `rpush`, `rpop`, `ensureStackSize`, `ensureRStackSize`, and `getStackData` form the primitive API used across ops. Guards throw `StackOverflowError`, `StackUnderflowError`, etc., sourced from `src/core/errors.ts`.
- **Global window helpers** – `gpush`, `gpop`, `gpeek` manipulate the heap segment (used heavily by list operations and the dictionary). References are encoded via `createGlobalRef()` and decoded by `getCellFromRef()`.
- **Code emission helpers** – `emitOpcode`, `emitUint16`, `emitFloat32`, `emitUserWordCall`, `emitTaggedAddress`, `patchUint16`, and `patchOpcode` delegate to the compiler module and are the canonical way to write bytecode from parser/meta code.

## 7. Memory Segments & Constants (`src/core/constants.ts`, `src/core/memory.ts`)

Tacit uses a single logical memory instance split into regions by convention:

- **Code segment (`SEG_CODE`)** – Holds bytecode (64 KB window by default). `memoryWrite8/16/Float32` mirror a flat address space, while the compiler writes sequentially via `CP`.
- **Data arena** – The data view is divided into Globals (`GLOBAL_BASE`), Data Stack (`STACK_BASE`), and Return Stack (`RSTACK_BASE`). Each section has `_BASE`, `_TOP`, and `_SIZE` constants expressed in both bytes and cells.
- **Strings** – Interned text lives in `SEG_STRING`, managed by `Digest`.
- **Cell size** – `CELL_SIZE` is 4 bytes (float32). Most arithmetic in `vm.ts` uses cell units to avoid repeated conversions.

The `Memory` abstraction (`src/core/memory.ts`) hides the `ArrayBuffer`/`DataView` plumbing and enforces per-segment bounds.

## 8. Operations & Builtins (`src/ops/`)

The `ops` directory contains the actual verbs that the interpreter dispatches.

- **Opcode registry** – `src/ops/opcodes.ts` enumerates every builtin opcode. Opcodes `< 128` are builtins; any value `>= 128` refers to user-defined code.
- **`executeOp()`** (`src/ops/builtins.ts`) – Routes execution:
  - **User-defined** – Pushes the caller frame onto the return stack and jumps to the encoded address (mirroring `callOp`).
  - **Builtins** – Looks up the opcode in a `Partial<Record<Op, TacitWord>>` map and invokes the implementation (math, stack, list, buffer, capsule, heap, dictionary, etc.). Missing opcodes throw `InvalidOpcodeError`.
- **Core control ops** – `src/ops/core/core-ops.ts` implements foundational instructions: `literalNumberOp`, `literalStringOp`, `branchOp`, `callOp`, `abortOp`, `exitOp`, `evalOp`, list delimiters, and compiler sentinels (`endDefinitionOp`, etc.).
- **Standard library** – Files like `math.ts`, `stack.ts`, `lists.ts`, `buffers.ts`, `heap.ts`, `capsules/*`, and `meta/*` supply the rest of the runtime behaviors. `builtins-register.ts` binds word names to opcodes and registers them in the dictionary during VM creation.
- **Immediate & meta words** – Many parser-time behaviors live under `src/lang/meta/` (conditionals, `with`, `match`, variable declarations). Their opcodes are flagged as immediates (dictionary payload meta bit set) so that encountering them during `emitWord()` runs the compile-time Tacit word instead of emitting executable bytecode.

## 9. Putting It Together

1. The REPL collects user input and hands it to `executeProgram()`.
2. The runner tokenizes and invokes `parse()`, which emits bytecode into the VM while updating the dictionary, capturing immediates, and validating structure.
3. `execute()` starts at `vm.compiler.BCP`, decodes each opcode, and dispatches to `executeOp()`.
4. Builtins implement the semantics of Tacit words, manipulating the VM’s stacks, heap, dictionary, and memory segments.
5. User-defined words, recorded in the dictionary with `Tag.CODE` payloads, compile down to `Op.Call`/`emitUserWordCall` sequences and execute via the same interpreter loop.

Armed with this walkthrough, you can trace any Tacit program from the REPL input, through parsing, bytecode generation, and all the way down to the VM primitives that mutate memory and stacks.
