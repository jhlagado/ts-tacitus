# TACIT AI Agent Instructions

## Project: ts-tacitus
TypeScript implementation of TACIT - stack-based language (Forth + APL + Joy). Point-free composition, NaN-boxed tagged values, polymorphic lists.

### Key Documentation
- **Lists**: See `.github/instructions/lists.md` for complete list specification
- **Tagged Values**: See `.github/instructions/tagged.md` for NaN-boxing details  
- **Capsules**: See `.github/instructions/capsules.md` for object model specification

## Development Workflow

### Before Coding (MUST)

- Ask clarifying questions
- Draft and confirm approach for complex work
- If more than two approaches exist, list pros/cons
- Generate multi-step plan → approval → execute step-by-step
- **NEVER**: Start without approved plan or deviate during execution

### Commands (Always `yarn`)

```bash
yarn test           # Jest --runInBand (required for test isolation)
yarn test:watch     # Watch mode
yarn build          # TypeScript compilation
yarn dev            # Run with ts-node
yarn lint           # ESLint --max-warnings=100
```

## Architecture Core

```
VM (vm.ts)           → Stack machine, segmented memory
Memory (memory.ts)   → 64KB segments: STACK, RSTACK, CODE, STRING
Tagged (tagged.ts)   → NaN-boxing in Float32 (corruption-sensitive)
Parser/Compiler      → Single-pass bytecode, shared compileCodeBlock()
Operations (ops/)    → Builtin verbs by category
```

### Critical Data Paths

1. **Raw floats**: `literal → vm.push(rawFloat) → writeFloat32` (safe)
2. **Tagged values**: `toTaggedValue() → NaN-boxed → writeFloat32` (corruption risk)
3. **Lists**: `LIST + elements + LINK` (stack metadata)

## Code Standards

### While Coding (MUST/SHOULD)

- Follow TDD: scaffold stub → failing test → implement
- Use existing TACIT domain vocabulary for consistency
- Functions over classes when testable functions suffice
- Prefer simple, composable, testable functions
- Use `import type { ... }` for type-only imports
- No inline comments except critical caveats; self-documenting code
- Default to `type`; use `interface` only when necessary
- Don't extract functions unless: reused elsewhere, only way to unit-test, or drastically improves readability

### TypeScript Specifics

- Branded types for IDs: `type UserId = Brand<string, 'UserId'>`
- **Portability** (TACIT → C/Assembly): Functions over objects, explicit loops over iterators, avoid spread/destructuring/for...of

### TACIT-Specific Constraints

- **Two data paths**: Raw floats (safe) vs tagged values (corruption-prone)
- **All operations list-aware**: Act on entire list structures
- **Broadcasting**: Modulo-based for mismatched lengths (default)
- **Stack semantics**: RPN/LIFO, top = last pushed

## Testing Standards

### Test Organization (MUST)

- Colocate unit tests (`*.test.ts`) with source
- Separate pure-logic unit tests from VM integration tests
- Use `--runInBand` to prevent test contamination
- Prefer integration tests over heavy mocking

### Test Quality (MUST/SHOULD)

- Parameterize inputs; no unexplained literals (`42`, `"foo"`)
- Tests must be able to fail for real defects
- Test description matches final assertion
- Compare to independent expectations, not function output
- Test entire structure in one assertion:
  ```typescript
  expect(vm.getStackData()).toEqual([1, 2, 3]); // ✅ Good
  expect(vm.getStackData()).toHaveLength(3); // ❌ Bad
  ```
- Strong assertions: `toEqual(1)` vs `toBeGreaterThanOrEqual(1)`
- Test edge cases, boundaries, realistic + unexpected input
- Don't test conditions caught by TypeScript

### TACIT Test Utilities

- `pushValue(vm, value, tag)`, `pushList(vm, values)`
- `getStackWithTags(vm)`, `resetVM()`, `formatStack(vm)`
- `executeTacitCode(code)`, `captureTacitOutput(code)`
- Remember: All stack operations are list-aware

## TACIT Domain Knowledge

### Stack & Memory Model

- **RPN/LIFO**: Top of stack = last pushed item
- **Fixed 32-bit cells**: NaN-boxed Float32 with tags
- **NaN corruption**: JS normalizes custom NaN payloads unpredictably
- **List format**: `LIST(length) + elements + LINK(backptr)`
- **LINK**: Stack metadata only, not part of list structure
- **Details**: See `lists.md` for complete list specification, `tagged.md` for NaN-boxing details

### List Examples

```
( 1 2 3 )      → LIST:3, 1, 2, 3, LINK:4
( 1 ( 2 3 ) 4) → LIST:5, 1, LIST:2, 2, 3, 4, LINK:6
( )            → LIST:0, LINK:1
```

### Capsule Model

- **Structure**: `[function, ...state_values]`
- **Invocation**: Sets `self` register, saves context on return stack
- **Non-reentrant**: Unless immutable
- **Dispatch**: Symbolic (`next`, `reset`) for sequences
- **Details**: See `capsules.md` for complete object model specification

## Quality Assessment

### Function Evaluation Checklist

1. **Readable**: Can you honestly follow what it does?
2. **Complexity**: High cyclomatic complexity (nested if-else)?
3. **Algorithms**: Better data structures (parsers, trees, stacks)?
4. **Parameters**: Unused params or unnecessary type casts?
5. **Testability**: Easily testable without mocking core features?
6. **Dependencies**: Hidden dependencies that should be parameters?
7. **Naming**: Consistent with TACIT domain vocabulary?

### Test Evaluation Checklist

1. **Parameterized**: No magic numbers/strings
2. **Failure potential**: Can fail for real defects
3. **Description alignment**: Matches final assertion
4. **Independent expectations**: Pre-computed, not function output
5. **Strong assertions**: Specific over general
6. **Edge cases**: Boundaries, realistic, unexpected input
7. **Type safety**: Don't test TypeScript-caught conditions

## Critical Debugging

### Tools

- `vm.getStackData()`, `formatStack(vm)`, `getStackWithTags(vm)`
- `memory.dump()`, `dumpTaggedValue()`
- `validateStackDepth()`, `safeStackOperation()`

### Common Issues

- **NaN corruption**: Use raw bit ops, avoid math/JSON on tagged values
- **Stack underflow**: Validate before operations
- **List traversal**: Follow LINK pointers correctly
- **Test isolation**: `resetVM()` between tests

## Critical Failure Patterns (AVOID)

### 1. Planning Discipline

- Never start without complete approved plan
- Execute step-by-step, stop and replan if issues arise
- Identify core issue first, separate from secondary effects

### 2. Code Hierarchy Awareness

- **Core files ≠ test files**: VM/memory/tagged are mission-critical
- **Fix architectural center first**: Usually tagged values/VM operations
- **248 failing tests = systemic issue**: Not 248 individual problems

### 3. Session Management

- Track changes systematically, resist scope creep
- Test compilation frequently, understand cascade effects
- When overwhelmed: STOP and reassess vs endless fix loops

## Key Principles

1. **List-aware operations** - all stack ops handle full structures
2. **NaN-boxing fragility** - tagged values corrupt easily in JS
3. **LINK is metadata** - not part of list, only for stack traversal
4. **Plan before action** - always get approval first
5. **Core before periphery** - fix architecture center first

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
