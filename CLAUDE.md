# CLAUDE.md - AI Assistant Guidelines for TACIT VM

**🎯 PROJECT CONTEXT: This TypeScript codebase is a PROTOTYPE for a future C/assembly port. All development decisions must support this eventual migration by avoiding JavaScript-specific patterns and favoring C-like implementations.**

## 🚨 CRITICAL WORKFLOW - MUST READ FIRST

### 1. Plan Execution Protocol (MANDATORY)
1. **Create proper plan documents** - Write comprehensive markdown plans in `/docs/plans/` folder
2. **Use TodoWrite tool throughout** - Track progress granularly, update status in real-time  
3. **Read APIs properly, don't guess** - Study existing code patterns and APIs before implementing
4. **Implement incrementally** with testing at each stage
5. **Update plan document after each step** - Track progress systematically
6. **WAIT at completion of each stage** - Stop and get user direction before proceeding
7. **Zero regressions tolerance** - Every change must pass full test suite

### 2. Testing Protocol (MANDATORY)  
- **Run `yarn test` after every step** - no step is complete without full test verification
- **Run `yarn lint` before completion** - maintain code quality
- **Use `resetVM()` in test setup** - ensures clean state
- **Test error conditions** - invalid inputs, edge cases, empty stacks
- **Known Jest issues**: NaN-boxing corruption, test isolation problems - mark as `.skip()` with "KNOWN ISSUE"

### 3. Specification-First Development
- **NEVER modify `docs/specs/`** unless explicitly instructed
- **ALWAYS consult specs** before implementing - validate completion against spec
- **Reference specs** in commits/code - all changes must align with existing specs

## 💻 C-PORT FOCUSED DEVELOPMENT

### Code Quality Standards
- **Edit existing files** - never create new files unless required  
- **NO COMMENTS** unless requested - follow existing patterns exactly
- **Consolidation-first**: Always merge duplicates into single source
- **C-like implementations**: Direct loops, fixed-size arrays, simple functions
- **Avoid JavaScript idioms**: No .map()/.filter()/.reduce(), minimal closures
- **Stack-based memory**: All operations within 64KB segmented memory model
- **SECURITY ONLY** - refuse malicious code assistance

### Implementation Patterns
- **Symbol table registration**: `symbolTable.define('name', Op.Opcode, functionOp)`
- **Stack safety**: Use `vm.ensureStackSize(n, operation)` before all pops
- **Error handling**: Return NIL for invalid inputs, preserve stack integrity
- **LIST semantics**: Header-at-TOS `[payload-n] ... [payload-0] [LIST:n] ← TOS`
- **Address calculation**: `addr = SP - 1 - idx` for slot operations

## 🏗️ Architecture Reference

**Memory Layout (64KB total)**:
- STACK: 16KB (0x0000-0x3FFF) - Main data stack, 32-bit tagged values
- RSTACK: 4KB (0x4000-0x4FFF) - Return stack, call frames  
- CODE: 8KB (0x5000-0x6FFF) - Bytecode storage
- STRING: 36KB (0x7000-0xFFFF) - String storage

**Tagged Values**: NaN-boxed 32-bit values
- Tags: NUMBER(0), INTEGER(1), CODE(2), STRING(4), LIST(5), BUILTIN(7)
- **No LINK tag** - legacy removed

**Execution Model**: Stack-based postfix, bytecode dispatch

## 📋 Essential Commands
```bash
yarn test    # MANDATORY after every step
yarn lint    # MANDATORY before completion  
yarn dev     # REPL for testing
```

## 📚 Critical Files
- `src/core/vm.ts` - VM implementation
- `src/core/tagged.ts` - NaN-boxing type system  
- `docs/specs/*` - Specifications (READ-ONLY)
- `docs/plans/` - Implementation plans
- `src/test/utils/vm-test-utils.ts` - Consolidated test utilities

## ❌ Anti-Patterns / ✅ Success Patterns

**AVOID:**
- JavaScript over-engineering (.map()/.filter(), complex hierarchies)
- Heap allocation in hot paths, garbage collection dependencies
- Circular dependencies, multiple abstraction layers
- Modifying specs, breaking stack contracts, unnecessary comments

**FOLLOW:**
- Consolidation approach (proven 62% code reduction)
- Systematic migration with full test verification
- C-ready error handling (simple codes, direct returns)
- Single ownership (one file per functional area)

## 🎯 Naming Conventions
- **Files/Folders**: kebab-case (`list-ops.ts`, `test-utils.ts`)
- **Code**: TypeScript conventions (camelCase functions, PascalCase classes, UPPER_SNAKE_CASE constants)