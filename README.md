# TACIT: Specification-Driven Development Structure

This project demonstrates **spec-driven development** where documentation is as important as source code. The codebase is organized around clear specifications, discrete tasks, and AI-assisted development workflows.

## 🗂 Project Structure

```
ts-tacitus/
├── src/             # Source code implementation
├── docs/            # All documentation and specifications
│   ├── specs/       # Canonical specifications (VM architecture, features)
│   │   └── drafts/  # Work-in-progress specifications
│   ├── tasks/       # Discrete work units for development
│   │   ├── plan-03-unified-code-reference-system.md  # Current active plan
│   │   └── done/    # Completed plans and tasks
│   ├── reference/   # Shared knowledge, glossary, and examples
│   └── rules/       # AI development guidelines and constraints
├── scripts/         # Development utilities and tools
└── coverage/        # Test coverage reports
```

## 📋 Development Workflow

### 1. Specification-First
All features begin with clear specifications in `specs/`. These documents define:
- **What** the feature does (overview and purpose)
- **How** it works (structure and constraints) 
- **Why** design decisions were made (rationale)

### 2. Task-Driven Implementation  
Each work unit is captured in `docs/tasks/` as a self-contained plan:
- **Active Plan**: `docs/tasks/plan-03-unified-code-reference-system.md` (current work)
- **Completed Plans**: Archived in `docs/tasks/done/` for reference
- **Goal**: Clear objective and success criteria
- **Dependencies**: Required specs and prior work
- **Constraints**: Technical and design limitations
- **Tests**: Expected behaviors and edge cases

### 3. AI-Assisted Development
Guidelines in `docs/rules/` ensure consistent:
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
- [`docs/specs/vm-architecture.md`](docs/specs/vm-architecture.md) - Memory layout and execution model
- [`docs/specs/tagged-values.md`](docs/specs/tagged-values.md) - Type system and encoding
- [`docs/specs/lists.md`](docs/specs/lists.md) - Compound data structures

### Test Coverage
- **54/59 test suites passing** (91.5% suite success rate)
- **762 individual tests passing** with comprehensive coverage
- **Known Issues**: 5 test suites failing (4 known isolation issues + 1 new issue from Step 10)

### Active Development
Current plan: [`docs/tasks/plan-03-unified-code-reference-system.md`](docs/tasks/plan-03-unified-code-reference-system.md)
- **CRITICAL ISSUES DISCOVERED**: Steps 8-10 need complete rework
- **Status**: Plan revision required - fundamental architectural flaws found
- **Problem**: Current implementation uses wrong approach (function table bypass vs. true direct addressing)
- **Solution**: 6 new steps (10.5-10.9) added to implement proper direct bytecode addressing

### Completed Work
Previous plans archived in [`docs/tasks/done/`](docs/tasks/done/):
- **Plan 00**: Project structure setup
- **Plan 01**: Test coverage improvement (74% coverage achieved)
- **Plan 02**: Test rationalization and cleanup

## 🔧 Developer Guide

### For AI Assistants
1. **Read relevant specs** before starting any task
2. **Follow rules in `docs/rules/ai-guidelines.md`**  
3. **Consult `docs/reference/` for examples and context**
4. **Update task status** when complete

### For Human Developers
1. **Understand the specs** before coding
2. **Create plans** for discrete work units  
3. **Test comprehensively** including edge cases
4. **Document decisions** and constraints

### Starting a New Plan
```bash
# Read the current active plan
cat docs/tasks/plan-03-unified-code-reference-system.md

# Review current step (Step 10)
# Find step details in the plan file

# Review dependencies  
cat docs/specs/vm-architecture.md
cat docs/specs/tagged-values.md

# Apply development rules
cat docs/rules/ai-guidelines.md

# Implement current step with testing
yarn test
```

## 📚 Knowledge Base

### Reference Materials
- [`docs/reference/glossary.md`](docs/reference/glossary.md) - TACIT terminology and concepts
- [`docs/reference/test-cases.md`](docs/reference/test-cases.md) - Examples and expected behaviors
- [`docs/reference/known-issues.md`](docs/reference/known-issues.md) - Documented test isolation and other issues
- [`docs/reference/spec-driven-demo.md`](docs/reference/spec-driven-demo.md) - Development methodology examples

### Specifications
- [`docs/specs/vm-architecture.md`](docs/specs/vm-architecture.md) - Core VM design and memory layout
- [`docs/specs/tagged-values.md`](docs/specs/tagged-values.md) - Type system implementation
- [`docs/specs/lists.md`](docs/specs/lists.md) - List structures and operations
- [`docs/specs/drafts/`](docs/specs/drafts/) - Work-in-progress specifications

### Related Projects
This structure can be applied to any software project where:
- **Documentation drives development**
- **Specifications are authoritative** 
- **AI assists human developers**
- **Quality and consistency matter**

## 🚀 Quick Start

```bash
# Install dependencies
yarn install

# Run tests
yarn test

# View current plan and active step
cat docs/tasks/plan-03-unified-code-reference-system.md

# Check completed work
ls docs/tasks/done/

# Start development session with AI
# 1. Read plan file and locate active step (Step 10)
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

## 📈 Current Project Status

### Test Coverage
- **55/59 test suites passing** (93.2% suite success rate)
- **763 individual tests passing** with comprehensive coverage
- **Known Issues**: 4 test suites with isolation issues documented in `docs/reference/known-issues.md`

### Active Development
- **Current Plan**: Unified @symbol reference system (Step 11/17)
- **Recent Completion**: Step 10 - Unified dispatch mechanism for executeOp
- **Next Milestone**: VM-level @ symbol resolution and tokenizer integration

### Architecture Highlights
- **64KB segmented memory** with STACK, RSTACK, CODE, and STRING segments
- **NaN-boxed tagged values** for efficient type representation
- **Unified code references** enabling metaprogramming with @symbol syntax
- **Immutable list structures** with LINK metadata for efficient operations

This implementation demonstrates a complete stack-based virtual machine with a specification-driven development approach, suitable for both educational purposes and practical language implementation.
