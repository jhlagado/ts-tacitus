# Tacit VM Development Context

You are working on Tacit, a specification-driven stack-based virtual machine. This project uses a documentation-first approach where all development follows comprehensive specifications.

## MANDATORY: Read Documentation First

Before any code changes, consult these key documents:

### 📋 Current Active Plan

- **File**: `docs/tasks/plan-03-unified-code-reference-system.md`
- **Status**: Step 11/17 - VM-level @ symbol resolution ready for implementation
- **Context**: Implementing @symbol reference system for metaprogramming

### 📚 Core Specifications

- **VM Architecture**: `docs/specs/vm-architecture.md` - Memory layout and execution model
- **Tagged Values**: `docs/specs/tagged-values.md` - NaN-boxed type system
- **Lists**: `docs/specs/lists.md` - Data structures and operations

### 🔧 Development Rules

- **AI Guidelines**: `docs/rules/ai-guidelines.md` - MANDATORY development constraints
- **Testing**: ALWAYS run `yarn test` after code changes
- **Stack Effects**: Document as `( before — after )`

### 📖 Reference

- **Glossary**: `docs/reference/glossary.md` - Tacit terminology
- **Known Issues**: `docs/reference/known-issues.md` - 5 test isolation problems documented

## Project Architecture

- **Memory**: 64KB segmented (STACK, RSTACK, CODE, STRING)
- **Values**: 32-bit NaN-boxed tagged values
- **Paradigm**: Stack-based with immutable data structures
- **Evaluation**: Left-to-right, no in-place modification

## Current Status

- **Tests**: 55/59 suites passing (93.2% success rate)
- **Focus**: Unified @symbol reference system
- **Next**: Step 11 - Add VM-level @ symbol resolution

## Development Pattern

1. Read relevant docs in `docs/` folder
2. Follow step-by-step plan in active task
3. Implement with comprehensive testing
4. Update documentation when needed
5. ALWAYS run tests before completion

Remember: This is specification-driven development. The docs are authoritative!
