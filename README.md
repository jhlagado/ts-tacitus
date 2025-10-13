# Tacit: A Compact Stack-Based Systems Language

Tacit is a stack-based programming language designed for systems programming with minimal runtime requirements. This TypeScript implementation serves as a prototype with C portability as a core design constraint.

## Design Philosophy

**No Garbage Collection**: If it can't be done in C, it can't be done in Tacit. The language uses explicit stack discipline and deterministic memory management.

**Compact Implementation**: The entire language system (tokenizer, parser, compiler, VM runtime) fits in ~8,500 lines of production code.

**Systems-Oriented**: Designed for low-level programming with direct control over memory layout, stack frames, and execution flow.

## Core Features

- **Stack-based execution** with explicit data and return stacks
- **Segmented memory model** (STACK, RSTACK, CODE, STRING)
- **NaN-boxed tagged values** for efficient type representation
- **Zero-copy data structures** using reverse-layout lists
- **Forth-like metaprogramming** with immediate words and code quotations
- **Deterministic resource management** - no hidden allocations or GC pauses

## Implementation

This TypeScript prototype demonstrates the language design while maintaining C portability constraints:

- **~8,500 lines** of production source code
- **~15,800 lines** of comprehensive tests (1.86:1 test-to-source ratio)
- **Complete compiler pipeline** from source to bytecode execution
- **700+ test cases** covering core VM, operations, and language features

## Technical Architecture

### Memory Model
```
┌─────────┐
│ STACK   │  Main data stack
├─────────┤
│ RSTACK  │  Return stack (frames, locals)
├─────────┤
│ CODE    │  Bytecode segment
├─────────┤
│ STRING  │  String storage & symbols
└─────────┘
```

### Type System
- **Tagged values** using NaN-boxing (32-bit cells)
- **No heap allocation** - all data stack-resident or in static segments
- **Explicit references** (STACK_REF, RSTACK_REF) for indirect access
- **Immutable lists** with reverse layout (header at high address)

### Control Flow
- **Immediate words** for compile-time control (`if/else`, `case/of`, `when/do`)
- **Code quotations** for higher-order functions
- **Stack-based calling convention** with explicit frame management
- **Shallow dispatch** for object-like capsules

## Project Structure

```
ts-tacitus/
├── src/
│   ├── core/        VM core, memory, tagged values
│   ├── lang/        Tokenizer, parser, compiler
│   ├── ops/         Operations and builtins
│   └── test/        Test suites
├── docs/
│   ├── specs/       Language specifications
│   ├── plans/       Implementation plans
│   │   └── done/    Completed plans (project history)
│   └── learn/       Tutorials and guides
└── scripts/         Development utilities
```

## Development Methodology

**Specification-Driven**: Features are specified completely before implementation.

**Plan-Based Execution**: Specifications guide detailed implementation plans with clear phases, test requirements, and exit criteria.

**Project History**: Completed plans in `docs/plans/done/` document the project's evolution and design decisions.

## Quick Start

```bash
# Install dependencies
yarn install

# Run tests
yarn test

# Start the REPL
yarn start
```

## Documentation

### Core Specifications
- [`docs/specs/vm-architecture.md`](docs/specs/vm-architecture.md) - Memory layout and execution model
- [`docs/specs/tagged.md`](docs/specs/tagged.md) - Type system and value encoding
- [`docs/specs/lists.md`](docs/specs/lists.md) - List structures and operations
- [`docs/specs/variables-and-refs.md`](docs/specs/variables-and-refs.md) - Local variables and references

### Language Features
- [`docs/specs/case-control-flow.md`](docs/specs/case-control-flow.md) - Case/of control structure
- [`docs/specs/capsules.md`](docs/specs/capsules.md) - Object-like capsules with dispatch
- [`docs/specs/metaprogramming.md`](docs/specs/metaprogramming.md) - Immediate words and compilation

### Getting Started
- [`docs/specs/README.md`](docs/specs/README.md) - Specification overview
- [`docs/learn/`](docs/learn/) - Tutorials and learning materials

## Language Strengths

**Predictability**: No garbage collection pauses, no hidden allocations, explicit resource management.

**Portability**: Design constraints ensure C portability - the TypeScript implementation is a prototype for a future C version.

**Compactness**: Small implementation suitable for embedded systems or resource-constrained environments.

**Metaprogramming**: Forth-style immediate words enable powerful compile-time abstractions without runtime cost.

**Testability**: Comprehensive test coverage with specification-based testing ensures correctness.

## Porting Strategy

The TypeScript implementation enforces C-portable constraints:
- No garbage collection
- Explicit memory management
- Stack-based resource allocation
- Fixed-size segments
- No dynamic dispatch beyond explicit VM operations

This ensures a straightforward port to C for production use in systems programming contexts.
