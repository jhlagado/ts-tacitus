# TACIT Programming Language - AI Agent Instructions

## Project Overview

This is **ts-tacitus**, a TypeScript implementation of the TACIT programming language - a stack-based, function-context-aware language inspired by Forth, APL, Lisp, and Joy. TACIT features point-free composition, NaN-boxed tagged values, and polymorphic list operations.

## Architecture

### Core Components

- **VM** (`src/core/vm.ts`): Stack-based virtual machine with segmented memory (data stack, return stack, code, strings)
- **Memory** (`src/core/memory.ts`): Segmented 64KB memory model with direct byte manipulation
- **Tagged Values** (`src/core/tagged.ts`): NaN-boxing system storing type+value in 32-bit IEEE 754 floats
- **Parser/Compiler** (`src/lang/`): Single-pass compiler generating bytecode with shared `compileCodeBlock()` pattern
- **Operations** (`src/ops/`): Builtin operations organized by category (arithmetic, stack, lists, etc.)

### Critical Data Flow

1. **Raw floats** (Tag.NUMBER): `literal → literalNumberOp → vm.push(rawFloat) → writeFloat32`
2. **Tagged values**: `toTaggedValue(value, tag) → NaN-boxed → writeFloat32 → potential corruption`
3. **Lists**: Stack-allocated with `LIST` tag + elements + `LINK` backpointer for traversal

## Development Workflow

### Commands (Always use `yarn`)

```bash
yarn test                 # Run all tests with Jest --runInBand
yarn test:watch          # Watch mode for development
yarn test:coverage       # Generate coverage reports
yarn build               # TypeScript compilation
yarn dev                 # Run with ts-node
yarn lint                # ESLint with --max-warnings=100
```

### Testing Patterns

- **Test isolation**: Use `--runInBand` to prevent contamination
- **Tagged value corruption**: JavaScript normalizes custom NaN values (0x7fc20003 → 0x7fc00000)
- **Test utilities**: 
  - `pushValue(vm, value, tag)` - Push tagged values onto stack
  - `pushList(vm, values)` - Create proper LIST + LINK structures
  - `getStackWithTags(vm)` - Decode stack with tag information
  - `resetVM()` - Complete VM state reset for test isolation
  - `executeTacitCode(code)` - Execute code and return stack results
  - `captureTacitOutput(code)` - Capture printed output from code execution
- **Memory debugging**: Use `vm.getStackData()` and memory dump methods
- **Stack debugging**: `formatStack(vm)` for readable stack traces with tags

## Code Conventions

### Style Rules

- **No inline comments**: Use terse block comments at file top only
- **Self-documenting code**: Clear variable/function names over explanatory comments
- **Multi-step planning**: Always propose detailed plans before implementation
- **Yarn only**: Never use npm, always use yarn for consistency

### NaN-Boxing Critical Knowledge

- **Two data paths**: Raw IEEE 754 floats (Tag.NUMBER) vs NaN-boxed tagged values
- **Corruption source**: JavaScript operations normalize NaN payloads unpredictably
- **Detection**: Use `!isNaN(value)` to distinguish raw floats from tagged values
- **Safe path**: Raw floats bypass NaN-boxing entirely, immune to normalization

### Stack Semantics

- **LIFO order**: Top of stack is last pushed item
- **List-aware operations**: `swap`, `dup`, `nip` operate on entire list structures
- **Broadcasting**: Modulo-based repetition for mismatched lengths (not strict mode)
- **Stack manipulation**: Always consider stack effects in RPN notation

### Portability Requirements

**TACIT is a prototype for eventual porting to C/assembly**, so code must be simple and portable:

- **Functions over objects** - Avoid complex OOP patterns
- **Explicit loops** - Use `for`/`while` instead of `.map()`, `.forEach()`, etc.
- **No modern ECMAScript** - Avoid spread, destructuring, for...of loops
- **Direct array access** - Use `array[i]` instead of iterators
- **NaN-boxing sensitivity** - Float32 values extremely sensitive to JS normalization

## List Architecture

### Structure

```
LIST: <length>     # Header with element count
<element1>         # Data elements
<element2>
...
LINK: <offset>     # Backpointer for stack traversal
```

### Key Concepts

- **LINK is stack metadata**, not part of list structure
- **Structurally immutable**: Copy for length/shape changes
- **In-place mutation allowed**: For simple value updates (counters, etc.)
- **Nested lists**: Stored inline without their own LINK tags

## Parser Patterns

### Shared Code Block Compilation

The `compileCodeBlock()` function implements the standard pattern:

```typescript
// BranchCall + offset → parseCurlyBlock → Exit → patch offset
Op.BranchCall → placeholder → {content} → Op.Exit → patch skip offset
```

Used by: standalone blocks `{}`, `do` combinator, `repeat` combinator

### Token Processing

- **Numbers**: Raw IEEE 754 compilation via `LiteralNumber` opcode
- **Tagged addresses**: Word quotes use `LiteralAddress` with 16-bit values
- **String literals**: Interned in digest with `LiteralString` opcode

## Memory Management

### Segmented Model

- **SEG_STACK**: Data stack operations
- **SEG_RSTACK**: Return stack (function calls, local vars)
- **SEG_CODE**: Compiled bytecode
- **SEG_STRING**: String interning table

### Critical Functions

- `writeFloat32/readFloat32`: For raw IEEE 754 values
- `writeTaggedValue/readTaggedValue`: For NaN-boxed values (avoid JS normalization)
- `vm.push/pop`: High-level stack operations using raw floats

## Integration Points

### Global State

- **vm singleton** (`src/core/globalState.ts`): Breaks circular VM↔Compiler dependency
- **Symbol table**: Maps words to opcodes and implementations
- **Digest**: String interning for symbols and literals

### Operation Registration

- Builtins registered in `builtins-register.ts` during VM construction
- Operations implement `Verb` interface: `(vm: VM) => void`
- Opcodes enumerated in `opcodes.ts` with sequential numbering
- Error handling: Use descriptive messages with stack state for debugging

## Debugging

### Memory Inspection

- `vm.getStackData()`: Array of current stack contents
- `memory.dump(start, end)`: Hex dump of memory ranges
- `dumpTaggedValue()`: Enhanced debugging for tagged values
- `getStackWithTags(vm)`: Stack contents with decoded tag information
- `formatStack(vm)`: Human-readable stack trace with value and tag pairs

### Common Issues

- **NaN corruption**: Use raw bit operations for tagged values
- **Stack underflow**: Check `ensureStackSize()` before operations
- **List traversal**: Follow LINK pointers correctly for variable-length data
- **Test isolation**: Reset VM state completely between tests using `resetVM()`
- **Memory alignment**: All stack operations work on 4-byte boundaries

### Stack Operation Patterns

All stack operations must follow these patterns:

- **Validation first**: Use `validateStackDepth(vm, requiredElements, operationName)` before operation
- **Error handling**: Use `safeStackOperation()` wrapper for complex operations
- **List awareness**: Operations like `dup`, `swap`, `over` handle entire list structures using `findElement()`
- **Stack effects**: Document and verify stack transformations in tests
- **Memory safety**: Preserve original stack state on errors using stack pointer restoration

### Error Patterns

- **Stack underflow**: `Stack underflow: 'operation' requires N operands (stack: [...])`
- **Invalid operations**: Include current stack state in error messages for debugging
- **VM state errors**: Use specific error types (`ReturnStackUnderflowError`, `StackUnderflowError`)
- **Tagged value errors**: Distinguish between raw floats and tagged value corruption

## Critical Knowledge for AI Agents

1. **Never assume inheritance** - TACIT avoids object-oriented patterns
2. **Always consider stack effects** - Every operation changes stack state
3. **Understand the two data paths** - Raw floats vs tagged values have different handling
4. **Test in isolation** - Use `--runInBand` to prevent cross-test contamination
5. **Plan before implementing** - Always propose multi-step plans for approval
6. **Use yarn exclusively** - Never use npm commands
7. **Respect the list format** - LINK is stack metadata, not list structure

## Critical Failure Patterns to Avoid

**Lessons from failed LLM sessions that must be avoided:**

### 1. Architectural Hierarchy Awareness
- **Core files ≠ test files** - `tagged.ts`, `vm.ts`, `memory.ts` are mission-critical
- **Fix core issues first** - Don't scatter-shot fix peripheral test utilities
- **248 failing tests = systemic issue** - Not 248 individual problems

### 2. Session Management
- **Execute approved plans step-by-step** - Don't deviate or fix-on-the-fly
- **Stop and replan when overwhelmed** - Don't enter endless fix loops
- **Track changes systematically** - Maintain awareness of what you've modified

### 3. Impact Assessment
- **Understand dependency cascades** - Know what breaks when you change core systems
- **Test compilation frequently** - Don't wait until the end
- **Measure progress vs. creating more problems** - Know if you're improving or degrading
