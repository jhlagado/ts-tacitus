# Gemini Directives for TACIT VM Development

## 🎯 PROJECT CONTEXT

This TypeScript codebase is a **PROTOTYPE** for a future C/assembly port. All development decisions must support this eventual migration by avoiding JavaScript-specific patterns and favoring C-like implementations.

## 📖 MANDATORY READING BEFORE CODING

Before implementing any features related to these areas, you MUST read these specifications:

- **`docs/specs/lists.md`** - Required before any LIST operations or compound data work
- **`docs/specs/tagged.md`** - Required before any tagged value manipulation

## 🚨 CRITICAL WORKFLOW

### 1. Plan Execution Protocol

1.  **Create proper plan documents** in `/docs/plans/`.
2.  **Implement incrementally** with testing at each stage.
3.  **Update plan document after each step**.
4.  **WAIT at completion of each stage** for user direction before proceeding.
5.  **Zero regressions tolerance**: Every change must pass the full test suite.

### 2. Testing Protocol

- **Run `yarn test` after every step**.
- **Run `yarn lint` before completion**.
- Use `resetVM()` in test setup.
- Test error conditions: invalid inputs, edge cases, empty stacks.
- **CRITICAL**: Never use `fromTaggedValue` in tests; it causes NaN-boxing corruption in Jest.
- Use **behavioral testing only**; test operation results, not internal tagged structure.

### 3. Specification-First Development

- **NEVER modify `docs/specs/`** unless explicitly instructed.
- **ALWAYS consult specs** before implementing.
- **Reference specs** in commits and code.

## 💻 C-PORT FOCUSED DEVELOPMENT

### Code Quality Standards

- **Edit existing files**; never create new files unless required.
- **NO COMMENTS** unless requested; follow existing patterns exactly.
- **Consolidation-first**: Always merge duplicates into a single source.
- **C-like implementations**: Use direct loops, fixed-size arrays, and simple functions.
- **Avoid JavaScript idioms**: No `.map()`, `.filter()`, `.reduce()`; minimal closures.
- **Stack-based memory**: All operations within the 64KB segmented memory model.

### Implementation Patterns

- **Symbol table registration**: `symbolTable.define('name', Op.Opcode, functionOp)`
- **Stack safety**: Use `vm.ensureStackSize(n, operation)` before all pops.
- **Error handling**: Return `NIL` for invalid inputs; preserve stack integrity.
- **LIST semantics**: Header-at-TOS `[payload-n] ... [payload-0] [LIST:n] ← TOS`
- **Address calculation**: `addr = SP - 1 - idx` for slot operations.

## 🏗️ ARCHITECTURE REFERENCE

- **Memory**: 64KB total (16KB STACK, 4KB RSTACK, 8KB CODE, 36KB STRING)
- **Tagged Values**: NaN-boxed 32-bit values. Active tags: `NUMBER`, `INTEGER`, `CODE`, `STRING`, `BUILTIN`, `LIST`.
- **Execution Model**: Stack-based postfix, bytecode dispatch.

## ❌ ANTI-PATTERNS / ✅ SUCCESS PATTERNS

**AVOID:**

- JavaScript over-engineering (`.map()`, `.filter()`, complex hierarchies).
- Heap allocation in hot paths.
- Modifying specs, breaking stack contracts, unnecessary comments.
- Manual list construction.

**FOLLOW:**

- Consolidation approach.
- Systematic migration with full test verification.
- C-ready error handling.
- Use TACIT code for test data: `executeTacitCode("( 1 2 3 )")`.
- **Read specifications first**.

## 🎯 NAMING CONVENTIONS

- **Files/Folders**: `kebab-case`
- **Code**: TypeScript conventions (camelCase functions, PascalCase classes, UPPER_SNAKE_CASE constants)
