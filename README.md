# TACIT: Specification-Driven Development Structure

This project demonstrates **spec-driven development** where documentation is as important as source code. The codebase is organized around clear specifications, discrete tasks, and AI-assisted development workflows.

## 🗂 Project Structure

```
ts-tacitus/
├── src/             # Source code implementation
├── specs/           # Canonical specifications (one per feature/module)
├── tasks/           # Discrete work units for development
│   ├── todo/        # Tasks ready for implementation
│   └── done/        # Completed tasks (for reference)
├── reference/       # Shared knowledge and examples
├── rules/           # AI development guidelines and constraints
└── .github/         # Legacy instruction files (being migrated)
```

## 📋 Development Workflow

### 1. Specification-First
All features begin with clear specifications in `specs/`. These documents define:
- **What** the feature does (overview and purpose)
- **How** it works (structure and constraints) 
- **Why** design decisions were made (rationale)

### 2. Task-Driven Implementation  
Each work unit is captured in `tasks/todo/` as a self-contained task:
- **Goal**: Clear objective and success criteria
- **Dependencies**: Required specs and prior work
- **Constraints**: Technical and design limitations
- **Tests**: Expected behaviors and edge cases

### 3. AI-Assisted Development
Guidelines in `rules/` ensure consistent:
- **Code quality**: Style, testing, documentation standards
- **Architectural alignment**: Following VM design principles
- **Specification compliance**: Implementation matches specs

## 🎯 Current Implementation: TACIT VM

TACIT is a stack-based programming language with:
- **64KB segmented memory** (STACK, RSTACK, CODE, STRING)
- **NaN-boxed tagged values** for type safety
- **Unified code references** for metaprogramming
- **Immutable list structures** with LINK metadata

### Key Specifications
- [`specs/vm-architecture.md`](specs/vm-architecture.md) - Memory layout and execution model
- [`specs/tagged-values.md`](specs/tagged-values.md) - Type system and encoding
- [`specs/lists.md`](specs/lists.md) - Compound data structures

### Active Development
Current plan: [`tasks/todo/plan-01-unified-code-reference-system.md`](tasks/todo/plan-01-unified-code-reference-system.md)
- **Step 8/17**: Implementing function table bypass mechanism
- Part of unified @symbol reference system
- 7 steps complete, 10 steps remaining

## 🔧 Developer Guide

### For AI Assistants
1. **Read relevant specs** before starting any task
2. **Follow rules in `rules/ai-guidelines.md`**  
3. **Consult `reference/` for examples and context**
4. **Update task status** when complete

### For Human Developers
1. **Understand the specs** before coding
2. **Create tasks** for discrete work units  
3. **Test comprehensively** including edge cases
4. **Document decisions** and constraints

### Starting a New Plan
```bash
# Read the plan definition
cat tasks/todo/plan-01-unified-code-reference-system.md

# Review current step (Step 8)
# Find step details in the plan file

# Review dependencies  
cat specs/vm-architecture.md
cat specs/tagged-values.md

# Apply development rules
cat rules/ai-guidelines.md

# Implement current step with testing
npm test
```

## 📚 Knowledge Base

### Reference Materials
- [`reference/glossary.md`](reference/glossary.md) - TACIT terminology and concepts
- [`reference/test-cases.md`](reference/test-cases.md) - Examples and expected behaviors
- [`.github/instructions/`](.github/instructions/) - Legacy detailed documentation

### Related Projects
This structure can be applied to any software project where:
- **Documentation drives development**
- **Specifications are authoritative** 
- **AI assists human developers**
- **Quality and consistency matter**

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run tests
npm test

# View current plan and active step
cat tasks/todo/plan-01-unified-code-reference-system.md

# Start development session with AI
# 1. Read plan file and locate active step
# 2. Review dependency specs  
# 3. Apply AI guidelines
# 4. Implement current step with testing
```

## 🎯 Benefits of This Approach

### For Development
- **Clear requirements** from specifications
- **Discrete work units** that can be tackled independently
- **Consistent quality** through guidelines and constraints
- **AI-friendly structure** for assisted development

### For Maintenance  
- **Authoritative documentation** that stays current
- **Complete context** for understanding decisions
- **Testable specifications** with concrete examples
- **Architectural coherence** across all changes

### For Collaboration
- **Shared vocabulary** through glossary and specs
- **Transparent process** with visible tasks and rules
- **Quality gates** through testing and validation
- **Knowledge preservation** in structured documentation

This structure demonstrates how documentation-driven development can create more maintainable, understandable, and AI-friendly codebases.
* A shaped array must be flat and must not contain nested structures.

Shapes may be functions or structured descriptors. Shape capsules provide richer metadata (e.g., dimensions, strides) and can be inspected programmatically.

Arrays can be reinterpreted as unshaped lists by removing the shape capsule. This enables transformation back to Lisp-style or per-value manipulation.

---

## Smart Capsules

TACIT supports **stateful capsules**—capsules that embed internal state such as stack pointers, counters, or buffer offsets.

This allows implementation of:

* Stacks
* Queues
* Iterators
* Lazy sequences

State is stored inside the capsule itself, enabling smart behaviors through encapsulated logic and introspectable structure.

---

## Broadcasting and Rank Semantics

Broadcasting in TACIT supports flexible polymorphism:

* Broadcasting between mismatched lengths uses **modulo-based repetition** of the shorter input.
* Scalars automatically broadcast as rank-zero arrays.
* Nested elements do **not** affect array rank—they are treated opaquely.
* Shaped arrays **must** be flat; nested items violate layout assumptions and yield undefined but non-fatal results.

A strict mode may be introduced for validation and debugging, but modulo broadcasting is the default.

---

## Data Representation

All values are stored as **32-bit tagged cells**, allowing:

* Packed byte arrays (e.g. UTF-8 strings, binary records)
* `float32` values (IEEE-754)
* Uniform stack operations across all data types

Capsules may include a **data width descriptor**, such as `uint8`, `float32`, or SIMD specifiers. This allows consistent interpretation of opaque lists as typed structures.

---

## Implementation Philosophy

TACIT aims to minimize the number of primitive concepts while maximizing compositional power. It avoids:

* Heap allocation and reference counting (deprecated)
* Special-case control flow
* Fixed arity function signatures

Instead, it builds everything from small, reusable pieces—capsules, sequences, lists, and polymorphic operators.

The language is designed to be small, introspectable, and expressive enough to host itself.

---

## Future Directions

* Full unification of sequences with capsules (e.g. iterator-like stateful capsules)
* Expansion of polymorphic operators over structured data
* Support for symbolic manipulation and program verification
* Self-hosted compiler and introspective runtime

---

## Getting Started

This repository contains the TACIT runtime, standard combinators, and documentation for the core language.

To explore:

* `src/` — VM implementation and combinators

