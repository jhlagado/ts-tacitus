# TACIT Programming Language - Comprehensive AI Agent Instructions

## Project Overview

This is **ts-tacitus**, a TypeScript implementation of the TACIT programming language - a stack-based, function-context-aware language inspired by Forth, APL, Lisp, and Joy. TACIT features point-free composition, NaN-boxed tagged values, and polymorphic list operations.

## Development Workflow and Planning

### Development Process (MUST)

- **MUST** Ask clarifying questions before implementing
- **MUST** Generate a multi-step plan with small, testable increments
- **MUST** Present the plan for review and approval
- **MUST** Wait for explicit permission before implementing
- **MUST** Execute only approved steps with testing at each stage
- **SHOULD** Draft and confirm approach for complex work
- **SHOULD** List pros/cons when multiple approaches exist

### Commands (Always use `yarn`)

```bash
yarn test                 # Run all tests with Jest --runInBand
yarn test:watch          # Watch mode for development
yarn test:coverage       # Generate coverage reports
yarn build               # TypeScript compilation
yarn dev                 # Run with ts-node
yarn lint                # ESLint with --max-warnings=100
```

### Plan Execution Discipline

- **NEVER** start implementing without a complete, approved plan
- **ALWAYS** identify the core issue first and separate from secondary effects
- **ALWAYS** understand the change's impact radius before starting
- When a plan is provided, **EXECUTE IT STEP BY STEP** without deviation
- If you discover new issues during execution, **STOP** and revise the plan

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

## Coding Standards

### Development Methodology

- **MUST** Follow TDD: scaffold stub → write failing test → implement
- **MUST** Use existing TACIT domain vocabulary for consistency
- **SHOULD NOT** Introduce classes when simple testable functions suffice
- **SHOULD** Prefer simple, composable, testable functions

### TypeScript Usage

- **MUST** Use `import type { … }` for type-only imports
- **SHOULD** Default to `type`; use `interface` only when necessary
- **SHOULD NOT** Extract functions unless:
  - Reused elsewhere, OR
  - Only way to unit-test otherwise untestable logic, OR
  - Drastically improves readability of opaque blocks

### Portability Requirements (TACIT → C/Assembly)

**TACIT is a prototype for eventual porting to lower-level languages.** Code must prioritize simplicity and portability:

#### Preferred Patterns:

- **Functions over objects** - Simple functions vs complex OOP patterns
- **Explicit loops** - Traditional `for`/`while` vs modern iterator methods
- **Direct array access** - `array[i]` vs `.forEach()`, `.map()`, etc.
- **Simple control flow** - Avoid complex ECMAScript features

#### Avoid These Features:

- **Spread operator** (`...array`) - Use explicit loops or `Array.concat()`
- **Destructuring** - Use explicit property access
- **for...of loops** - Use traditional indexed `for` loops
- **Iterator methods** (`.map()`, `.filter()`, `.reduce()`) - Use explicit loops
- **Arrow functions in complex contexts** - Prefer named functions

#### Example:

```typescript
// GOOD - Simple, portable, safe for NaN-boxing
function processStack(stack: number[]): number[] {
  const result: number[] = [];
  for (let i = 0; i < stack.length; i++) {
    const value = stack[i];
    result[i] = processValue(value);
  }
  return result;
}

// AVOID - Uses features that don't port well
const processStack = (stack: number[]) => stack.map(value => processValue(value));
```

### Comments and Documentation

- **SHOULD NOT** Use inline `//` comments except for critical caveats
- **SHOULD** Use terse block comments at file top only
- **MUST** Write self-documenting code with clear names
- **SHOULD** Use separate documentation files for detailed explanations

## Testing Standards

### Test Organization

- **MUST** Colocate unit tests in same directory as source (`*.test.ts`)
- **MUST** Separate pure-logic unit tests from VM integration tests
- **SHOULD** Prefer integration tests over heavy mocking
- **SHOULD** Group tests by functional domain, not file location
- **SHOULD** Use flat describe hierarchies (maximum 2 levels)

### Test Quality Standards

- **SHOULD** Parameterize inputs; avoid unexplained literals like `42` or `"foo"`
- **SHOULD NOT** Add tests that cannot fail for real defects
- **SHOULD** Ensure test description matches final assertion
- **SHOULD** Compare to independent expectations, not function output
- **SHOULD** Test entire structure in one assertion when possible:
  ```typescript
  expect(vm.getStackData()).toEqual([1, 2, 3]); // Good
  expect(vm.getStackData()).toHaveLength(3); // Bad
  ```
- **SHOULD** Test edge cases and value boundaries
- **SHOULD NOT** Test conditions caught by TypeScript

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

### TACIT-Specific Test Considerations

- **MUST** Remember all stack operations are list-aware
- **SHOULD** Test both simple values and list structures
- **SHOULD** Use consistent VM setup/teardown patterns
- **SHOULD** Test stack effects and memory safety
- **SHOULD** Focus on single aspect of functionality per test

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

## TACIT Architecture Fundamentals

### Stack Semantics and RPN Notation

- **CRITICAL**: TACIT uses RPN (Reverse Polish Notation) with LIFO stack semantics
- **Top of stack** is the last item pushed - operations like `dup` and `swap` affect most recent items
- **Stack juggling** may be required to arrange operands for operations expecting specific inputs
- **All stack operations are list-aware** - they operate on entire list structures, not individual elements

### Memory Model and Data Representation

- **Fixed-size stack cells**: All values occupy same size (currently NaN-boxed Float32s with tagged values)
- **Critical NaN-Boxing**: Float32 values extremely sensitive to JavaScript normalization
- **Avoid NaN corruption**: Use explicit bit manipulation, avoid certain math operations and JSON serialization
- **Test NaN-boxed values carefully** - JavaScript can silently corrupt tagged NaN payloads

### List Architecture and Semantics

- **Structurally immutable**: Changes to length/shape require copying
- **In-place mutation allowed**: For simple values within lists (e.g., counters)
- **LINK metadata**: External to list structure, used only for stack traversal
- **List format**: `LIST` tag (length) + elements + `LINK` tag (backpointer)
- **Nested lists**: Stored inline without their own LINK tags
- **Broadcasting**: Modulo-based broadcasting for mismatched lengths (default behavior)

#### Critical List Specification Details

**LINK is stack metadata, not part of list structure:**
- LINK points backward to list header (LIST) from top of stack
- Required only for stack representation of variable-length objects
- Not stored in memory representation
- External to the list, used only to locate list header from TOS

**List Construction Examples:**
- Simple: `( 1 2 3 )` becomes: `LIST: 3, 1, 2, 3, LINK: 4`
- Nested: `( 1 ( 2 3 ) 4 )` becomes: `LIST: 5, 1, LIST: 2, 2, 3, 4, LINK: 6`
- Zero-length: `( )` becomes: `LIST: 0, LINK: 1`

### Execution Model

- **List-aware operations**: All stack operations handle entire list structures using list traversal
- **Polymorphic**: Operations apply over entire lists with APL-like broadcasting semantics
- **Capsule model**: Lists where element 0 is function reference, rest are state values
- **Context switching**: `self` register for method dispatch, return stack for nested contexts

#### Capsule Invocation Protocol

On capsule call:
- `self` is set to the capsule list
- Return stack stores: instruction pointer (ip), previous self, and optionally base pointer (bp)
- On entry: ip is set to capsule function; self is updated; bp is optionally updated
- On return: sp is restored; bp, self, and ip are popped
- bp is optional and enables access to local variables on the return stack
- Capsules are non-reentrant unless immutable
- Instance state is accessed via self; local state via bp if used

#### Broadcasting and Polymorphism

- **Modulo-based broadcasting**: Default behavior for mismatched lengths
- **Rank semantics**: Normal list = rank-1 array, scalar = rank-0 array
- **Nested lists**: Treated as opaque elements, don't contribute to rank
- **Shaped lists**: Must remain flat to preserve stride-based indexing
- **Scan primitive**: Reductions implemented as `scan` followed by `last`

### Sequence Protocol

Capsules support symbolic dispatch:
- `next`: Returns next value, `nil` when exhausted
- `reset`: Rewinds internal cursor to beginning
- Enables stateful traversal with internal logic

### Object Model

- **No inheritance**: Simple prototype-based model
- **Field access**: Via symbolic access list mapping to capsule slots
- **Method dispatch**: Through capsule function at slot 0
- **Byte data**: Packed into 32-bit words for uniform stack behavior

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
- **Lists**: Left-to-right construction with LIST + elements + LINK pattern

## Memory Management

### Segmented Model

- **SEG_STACK**: Data stack operations
- **SEG_RSTACK**: Return stack (function calls, local vars)
- **SEG_CODE**: Compiled bytecode
- **SEG_STRING**: String interning table

## Quality Assurance

### Function Quality Assessment

When evaluating implemented functions, verify:

1. **Readability**: Can you honestly follow what the function does?
2. **Complexity**: Does it have high cyclomatic complexity (too many nested if-else)?
3. **Data structures**: Are there better algorithms/patterns (parsers, trees, stacks)?
4. **Parameters**: Any unused parameters or unnecessary type casts?
5. **Testability**: Easily testable without mocking core VM features?
6. **Dependencies**: Any hidden dependencies that should be parameters?
7. **Naming**: Consistent with TACIT domain vocabulary?

### Test Quality Assessment

When evaluating implemented tests, verify:

1. **Parameterized inputs**: No unexplained literals like `42` or `"foo"`
2. **Real failure potential**: Test can fail for actual defects
3. **Description alignment**: Test description matches final assertion
4. **Independent expectations**: Compare to pre-computed values, not function output
5. **Strong assertions**: Use `toEqual(1)` vs `toBeGreaterThanOrEqual(1)`
6. **Edge cases**: Test boundaries, realistic input, unexpected input
7. **Type safety**: Don't test conditions caught by TypeScript

### Architecture Assessment Priorities

1. **Core files ≠ test files** - VM, memory, tagged values are mission-critical
2. **Identify architectural center** - usually tagged values, VM operations, or memory
3. **Fix core issues first** - then cascade fixes outward to tests and utilities
4. **Impact radius understanding** - know what breaks when you change core systems

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

## Critical Lessons for Complex Codebase Modifications

**The following are critical learnings from failed LLM sessions that must be avoided:**

### 1. Plan Execution Discipline

- **NEVER** start implementing without a complete, approved plan
- **ALWAYS** identify the core issue first and separate it from secondary effects
- **ALWAYS** understand the change's impact radius before starting
- When a plan is provided, **EXECUTE IT STEP BY STEP** without deviation
- If you discover new issues during execution, **STOP** and revise the plan rather than fixing on-the-fly

### 2. Architectural Awareness - Code Hierarchy Matters

- **Core files are NOT equal to test files** - treat core VM, memory, and tagged value systems as mission-critical
- **Identify the architectural center** of any change - in TACIT this is usually tagged values, VM operations, or memory management
- **Test utilities and individual tests are peripheral** - fix core issues first, then cascade fixes outward
- **Never treat all code as equal importance** - this leads to inefficient scatter-shot fixing

### 3. Session Memory and Focus Management

- **Track your changes systematically** - maintain awareness of what you've modified and why
- **Resist scope creep** - fixing one thing does not mean fixing everything you encounter
- **Remember the original goal** throughout the session - don't get lost in secondary failures
- **When overwhelmed, STOP and reassess** rather than continuing in an endless fix loop

### 4. Compilation and Dependency Understanding

- **Understand import dependencies** before making changes - know what exports what
- **Fix imports systematically** - don't scatter import fixes across multiple files simultaneously
- **Test compilation frequently** during changes rather than at the end
- **Critical system files** (like tagged.ts) are architectural keystones - understand their role completely

### 5. Test Failure Pattern Recognition

- **248 failing tests means systemic issue** - not 248 individual problems to fix
- **Tagged value corruption** is a specific pattern with specific fixes - don't treat as generic bugs
- **Type mismatches** between test expectations and VM output indicate fundamental misunderstanding
- **Massive test failures require systematic fixes** - not file-by-file debugging

### 6. Impact Assessment Before Action

- **Always identify what breaks when you change core systems** - anticipate cascade effects
- **Understand the difference between fixing corruption vs. fixing tests** - these are different problem classes
- **Map dependencies** before making changes to shared utilities or core data structures
- **Measure your changes** - know if you're making progress or creating more problems

### Execution Mandate

When working on complex changes, LLMs must:

1. Identify the core architectural issue
2. Create a prioritized plan focusing on core files first
3. Execute systematically without deviation
4. Maintain awareness of the overall goal
5. Stop and replan if overwhelmed rather than thrashing

**Failure to follow these principles results in session failure and wasted development time.**
