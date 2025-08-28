# 🚀 ONBOARDING: TACIT VM Development

## Introduction

Welcome to the TACIT VM development project! This document is designed to rapidly onboard new contributors, especially Large Language Models (LLMs), to effectively understand and contribute to this codebase.

**Our primary goal is to develop a robust and efficient Virtual Machine for the TACIT language, with a strong focus on its eventual port to C/assembly.** This means all development decisions prioritize C-like implementations and avoid JavaScript-specific patterns.

By following the steps outlined here, you will gain a comprehensive understanding of the project's architecture, coding standards, development workflows, and the TACIT language itself.

## 📚 Foundational Documents

Before making any changes or implementing new features, it is crucial to understand the core principles, architectural constraints, and development workflows of this project. Read the following documents thoroughly:

1.  **`GEMINI.md`**: Contains the primary directives for Gemini (me) regarding project context, mandatory reading, critical workflows, C-port focused development, architecture reference, anti-patterns, and naming conventions. This is your core operational guide.
2.  **`CLAUDE.md`**: Provides similar directives and guidelines for Claude, another AI assistant working on this project. Review this to understand the shared and distinct expectations for AI agents, ensuring consistent collaboration.
3.  **`docs/rules/ai-guidelines.md`**: Details specific rules and guidelines for AI development, including core principles, implementation rules, architectural constraints, development workflow, communication guidelines, and anti-patterns to avoid. This document is essential for ensuring your contributions align with project standards and maintain high quality.

## 📖 Core Specifications

The following specifications are fundamental to understanding the TACIT VM and its data structures. You **MUST** consult these documents before implementing any features related to their respective areas. Adhering to these specifications is paramount for maintaining consistency and enabling the future C/assembly port.

-   **`docs/specs/access.md`**: Details the `get` and `set` polymorphic access operators for uniform traversal and modification of nested data structures using paths.
-   **`docs/specs/capsules-reified.md`**: Explains the unified model of local variables and fields, where capsule construction is a frame transfer, simplifying compiler and runtime logic.
-   **`docs/specs/lists.md`**: Defines the contiguous, stack-resident list structure, including representation, traversal, operations, and mutation rules. This is foundational for all compound data.
-   **`docs/specs/local-vars.md`**: Specifies the local variable system and function stack frame layout, including variable declaration, access, and lifetime.
-   **`docs/specs/maplists.md`**: Describes maplists as key-value alternating lists, providing TACIT's primary associative data structure, building on the foundational list infrastructure.
-   **`docs/specs/polymorphic-operations.md`**: Outlines the expected behavior of TACIT operations when encountering reference values, establishing consistent semantics across operations.
-   **`docs/specs/stack-operations.md`**: Covers the fundamental stack model, RPN execution, stack effect notation, and common operations, crucial for understanding data flow.
-   **`docs/specs/tagged.md`**: The canonical source for active runtime tags, payload bit widths, and encoding rules for NaN-boxed values, essential for type system understanding.
-   **`docs/specs/vm-architecture.md`**: Provides an overview of the TACIT VM's stack-based architecture, segmented memory layout, and execution model.
-   **`docs/specs/drafts/var-indexing.md`**: A draft specification detailing the terms, surface syntax, parser treatment, and opcode palette for variable indexing.

Always reference these specifications in your commits and code when implementing features related to them.

## 💻 Codebase Overview

To gain a comprehensive understanding of the project's implementation, it is essential to review the source code. The primary source files are located in the `src/` directory and its subdirectories.

**Key areas to focus on include:**

-   **`src/core/`**: Contains the core Virtual Machine (VM) implementation, memory management, tagged value system, and fundamental data structures like lists.
-   **`src/lang/`**: Houses the language processing components, including the tokenizer, parser, compiler, interpreter, and REPL (Read-Eval-Print Loop).
-   **`src/ops/`**: Defines all built-in operations (opcodes) and their implementations, categorized by functionality (math, stack, control flow, list operations, etc.).
-   **`src/strings/`**: Manages string storage (digest) and the symbol table, which handles word definitions and symbol resolution.
-   **`src/test/`**: Contains a comprehensive suite of unit and integration tests. Reviewing these tests can provide valuable insights into expected behavior, edge cases, and how different components interact.

Familiarize yourself with the overall structure and the purpose of each module. Pay attention to how the concepts from the specifications (e.g., NaN-boxing, stack-based execution, list representation) are translated into code.

## 🧪 Testing and Tacit Syntax

To understand how the project ensures correctness and to familiarize yourself with the Tacit language syntax, it is highly recommended to review the test files.

**Key aspects to focus on:**

-   **Test Structure**: Observe how tests are organized (unit, integration, end-to-end) and how `jest` is used.
-   **`vm-test-utils.ts`**: This utility file in `src/test/utils/` provides helper functions like `executeTacitCode`, `testTacitCode`, and `captureTacitOutput`. These are crucial for writing and understanding tests.
-   **Tacit Code Examples**: Pay close attention to the strings passed to `executeTacitCode` and similar functions. These strings contain actual Tacit code snippets, demonstrating the language's syntax, operators, and control flow in practical scenarios. This is an excellent way to learn the language by example.
-   **Assertions**: Understand the types of assertions used (e.g., `expect(result).toEqual(...)`, `expect().toThrow()`) to verify VM behavior and output.
-   **Edge Cases**: Tests often cover edge cases and error conditions, which can provide deeper insights into the VM's robustness and expected behavior under unusual circumstances.

By studying the tests, you will not only grasp the project's testing philosophy but also gain practical exposure to the Tacit language itself.

## 🛠️ Development Workflow and Best Practices

Adhering to the established development workflow and best practices is critical for maintaining code quality, consistency, and ensuring a smooth transition to the C/assembly port.

### 1. Specification-First Development

-   **ALWAYS consult relevant specifications** in `docs/specs/` before implementing any features.
-   **NEVER modify `docs/specs/` files** unless explicitly instructed.
-   **Validate against specifications** before considering an implementation complete.
-   **Reference specs in commit messages** and code comments (sparingly, for *why*).

### 2. C-Port Focused Development

-   **C-like implementations**: Favor direct loops, fixed-size arrays, and simple functions.
-   **Avoid JavaScript idioms**: Do not use `.map()`, `.filter()`, `.reduce()`, or complex closures in hot paths.
-   **Stack-based memory**: All operations must operate within the 64KB segmented memory model.
-   **No comments unless requested**: Follow existing patterns exactly. If comments are necessary, focus on *why* something is done, not *what*.

### 3. Testing Protocol

-   **Run `yarn test` after every significant change**. This ensures zero regressions.
-   **Run `yarn lint` before completing any task**. This enforces code style and quality.
-   **Use `resetVM()` consistently** in test setup to ensure a clean state.
-   **Test error conditions**: Include invalid inputs, edge cases, and empty stacks.
-   **CRITICAL**: Never use `fromTaggedValue` in tests; it can cause NaN-boxing corruption in Jest.
-   **Behavioral testing only**: Test operation results, not internal tagged structure.

### 4. Code Quality Standards

-   **Consolidation-first**: Always merge duplicates into a single source.
-   **Stack safety**: Use `vm.ensureStackSize(n, operation)` before all pops.
-   **Error handling**: Return `NIL` for invalid inputs; preserve stack integrity.
-   **Symbol table registration**: Use `symbolTable.define('name', Op.Opcode, functionOp)` for built-ins.

### 5. Critical Workflow

-   **Plan Execution Protocol**:
    1.  Create proper plan documents in `/docs/plans/`.
    2.  Implement incrementally with testing at each stage.
    3.  Update plan document after each step.
    4.  **WAIT at completion of each stage** for user direction before proceeding.
    5.  Zero regressions tolerance: Every change must pass the full test suite.

## ▶️ Next Steps

Congratulations on completing the initial onboarding! You now have a foundational understanding of the TACIT VM project. Here are some suggested next steps to deepen your expertise and begin contributing effectively:

1.  **Explore the `docs/plans/` directory**: Review existing and completed plans to understand how features are designed and implemented incrementally.
2.  **Familiarize yourself with `yarn test` and `yarn lint`**: Practice running these commands to ensure your environment is set up correctly and you can verify code quality.
3.  **Implement a small, well-defined task**: Start with a minor bug fix or a small feature addition. Always create a plan document in `docs/plans/draft/` first, following the "Plan Execution Protocol" outlined above.
4.  **Ask clarifying questions**: If any aspect of the project, a specification, or a task is unclear, do not hesitate to ask for clarification. Precision is key in this codebase.
5.  **Propose improvements**: Once you're comfortable, feel free to suggest enhancements to the codebase, documentation, or development process, always aligning with the C-port focus.

Remember to always prioritize **specification-first development**, maintain **stack safety**, and ensure **zero regressions** in your contributions.