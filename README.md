# TACIT: Stack-Based Virtual Machine

TACIT is a stack-based programming language and virtual machine implementation with comprehensive specifications and a documentation-driven development approach.

## 🗂 Project Structure

```
ts-tacitus/
├── src/             # TypeScript implementation of the VM
├── docs/            # Comprehensive documentation and specifications
│   ├── specs/       # Core specifications (VM architecture, features)
│   │   └── drafts/  # Work-in-progress specifications
│   ├── tasks/       # Development plans and work units
│   │   └── done/    # Completed development tasks
│   ├── reference/   # Glossary, examples, and reference materials
│   └── rules/       # Development guidelines and constraints
├── scripts/         # Development utilities and debugging tools
└── coverage/        # Test coverage reports
```

## ⚙️ Technical Features

TACIT implements a complete stack-based virtual machine with:

- **64KB segmented memory** (STACK, RSTACK, CODE, STRING segments)
- **NaN-boxed tagged values** for efficient type representation
- **Unified code references** enabling metaprogramming capabilities
- **Immutable list structures** with LINK metadata
- **Comprehensive type system** with built-in operations
- **Stack-based execution model** with call frame management

### Core Specifications
- [`docs/specs/vm-architecture.md`](docs/specs/vm-architecture.md) - Memory layout and execution model
- [`docs/specs/tagged-values.md`](docs/specs/tagged-values.md) - Type system and value encoding
- [`docs/specs/lists.md`](docs/specs/lists.md) - List structures and operations

## 🧪 Testing & Quality

- **Comprehensive test coverage** with 700+ individual tests
- **Multiple test suites** covering core VM, operations, and language features
- **Specification-based testing** ensuring implementation matches design
- **Continuous integration** with automated testing

## � Development Methodology

This project demonstrates **specification-driven development** where documentation and implementation evolve together:

### 1. Specification-First Approach
- **Clear specifications** define features before implementation
- **Architectural decisions** documented with rationale
- **Dependencies and constraints** explicitly captured

### 2. Task-Driven Implementation  
- **Discrete work units** in `docs/tasks/` with clear objectives
- **Step-by-step plans** with testing requirements
- **Progress tracking** and completion criteria

### 3. Quality Assurance
- **Comprehensive testing** including edge cases
- **Code quality guidelines** for consistency
- **Documentation maintenance** aligned with implementation

## 🚀 Getting Started

```bash
# Install dependencies
yarn install

# Run the full test suite
yarn test

# Start the TACIT REPL
yarn start

# View test coverage
yarn test --coverage
```

## 🔧 Development Workflow

```bash
# Review project structure
ls docs/specs/        # Core specifications
ls docs/tasks/        # Development plans
ls docs/reference/    # Examples and glossary

# Run specific test suites
yarn test core        # Core VM functionality
yarn test ops         # Operations and built-ins
yarn test lang        # Language processing
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

### Applications
This specification-driven approach is suitable for:
- **Language implementation** and virtual machine development
- **Educational projects** demonstrating VM concepts
- **Research platforms** for stack-based programming languages
- **AI-assisted development** with clear documentation structure

## 🚀 Quick Start

```bash
# Install dependencies
yarn install

# Run tests
yarn test

# Start the TACIT REPL to try the language
yarn start

# Explore the documentation
cat docs/specs/vm-architecture.md    # Understand the VM design
cat docs/reference/glossary.md       # Learn TACIT terminology
ls docs/tasks/                       # See development history
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

## 📈 Project Highlights

### Architecture
- **Stack-based execution** with proper call frame management
- **Memory segmentation** for efficient resource allocation
- **Type safety** through tagged value system
- **Metaprogramming support** with unified code references

### Documentation
- **Comprehensive specifications** covering all major components
- **Development methodology** demonstrating specification-driven approach
- **Extensive reference materials** including glossary and examples
- **Quality guidelines** ensuring consistent implementation

### Testing
- **High test coverage** across all major components
- **Specification-based testing** ensuring correctness
- **Edge case coverage** for robust implementation
- **Continuous validation** through automated testing

This project demonstrates how thoughtful architecture, comprehensive documentation, and rigorous testing can create a maintainable and extensible virtual machine implementation.
