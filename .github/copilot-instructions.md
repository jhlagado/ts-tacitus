# GitHub Copilot Instructions for Tacit VM

## Project Overview

Tacit is a specification-driven stack-based virtual machine project with comprehensive documentation in the `docs/` folder.

## Documentation Structure

Before making any code changes, consult the relevant documentation:

### Core Specifications (`docs/specs/`)

- **`docs/specs/vm-architecture.md`** - Memory layout, execution model, and VM design
- **`docs/specs/tagged-values.md`** - NaN-boxed type system and value encoding
- **`docs/specs/lists.md`** - List structures, LINK metadata, and operations
- **`docs/specs/drafts/`** - Work-in-progress specifications

### Active Development (`docs/tasks/`)

- **`docs/tasks/plan-03-unified-code-reference-system.md`** - Current active development plan
  - Currently on Step 10/17: Unified dispatch mechanism
  - 9 steps complete, 8 remaining
  - Focus: @symbol reference system for metaprogramming
- **`docs/tasks/done/`** - Completed plans and historical context

### Development Guidelines (`docs/rules/`)

- **`docs/rules/ai-guidelines.md`** - Mandatory development rules and constraints
  - ALWAYS run tests after code changes
  - Follow Tacit language conventions
  - Use specification-first development
  - Maintain stack effect notation: `( before — after )`

### Reference Materials (`docs/reference/`)

- **`docs/reference/glossary.md`** - Tacit terminology and concepts
- **`docs/reference/known-issues.md`** - Documented issues (5 test isolation problems)
- **`docs/reference/test-cases.md`** - Examples and expected behaviors

## Development Protocol

### Before Any Implementation:

1. **Read the current plan**: `docs/tasks/plan-03-unified-code-reference-system.md`
2. **Check current step**: Currently Step 10 (unified dispatch mechanism)
3. **Review relevant specs**: Always check VM architecture and tagged values
4. **Follow AI guidelines**: `docs/rules/ai-guidelines.md` contains mandatory rules

### Code Quality Requirements:

- **Stack safety**: Always validate stack depth before operations
- **Memory bounds**: Respect 64KB segmented memory layout
- **Type safety**: Use tagged values consistently
- **Test coverage**: Write comprehensive tests including edge cases
- **Documentation**: Update relevant docs when changing functionality

### Architecture Constraints:

- **64KB total memory** with STACK, RSTACK, CODE, STRING segments
- **32-bit tagged values** using NaN-boxing
- **Immutable data structures** - no in-place modification
- **Left-to-right evaluation** - all operations process arguments in order

### Current Project Status:

- **54/59 test suites passing** (91.5% success rate)
- **762 individual tests passing**
- **Known issues**: 5 test suites with isolation problems (documented)
- **Active work**: Step 10 of unified @symbol reference system

## Testing Requirements:

- **MANDATORY**: Run `yarn test` after every code change
- Use `resetVM()` in test setup for clean state
- Test happy path, error conditions, and edge cases
- Maintain existing test coverage levels

## File Organization:

- `src/core/` - Core VM components (memory, tagged values, VM state)
- `src/ops/` - Operations and built-in functions
- `src/lang/` - Language processing (parser, compiler, interpreter)
- `src/stack/` - Stack manipulation utilities
- `src/strings/` - String handling and symbol table
- `src/test/` - Comprehensive test suites

## Key Implementation Patterns:

- Use `vm.ensureStackSize(n, operation)` for stack validation
- Follow existing error handling patterns in `src/core/errors.ts`
- Maintain stack effect documentation for all operations
- Use consistent naming: kebab-case for files, camelCase for functions

## When Uncertain:

- Check `docs/reference/glossary.md` for terminology
- Review `docs/reference/known-issues.md` for documented problems
- Consult relevant specifications before implementation
- Follow the step-by-step plan in the active task document
