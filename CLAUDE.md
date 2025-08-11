# CLAUDE.md - AI Assistant Guidelines for TACIT VM

**🎯 PROJECT CONTEXT: This TypeScript codebase is a PROTOTYPE for a future C/assembly port of the TACIT VM. All development decisions must support this eventual migration by avoiding JavaScript-specific patterns and favoring C-like implementations.**

## 🚨 CRITICAL RULES - MUST READ FIRST

### 1. Specification-First Development
- **NEVER modify `docs/specs/`** unless explicitly instructed
- **ALWAYS consult specs** before implementing - validate completion against spec
- **Reference specs** in commits/code - all changes must align with existing specs

### 2. Testing Protocol (MANDATORY)
- **Run `yarn test` after every step** - catch regressions early
- **Use `resetVM()` in test setup** - ensures clean state
- **Test error conditions** - invalid inputs, edge cases, empty stacks
- **Run `yarn lint`** before completion
- You cannot consider a step in a plan complete until all tests pass

### 3. Known Test Environment Issues (IGNORE)
- **Jest NaN-boxing corruption**: Intermittent Tag.LIST/Tag.CODE failures - tags show as Tag.NUMBER(0)
- **Test isolation problems**: Tests pass individually but fail in full suite  
- **Parsing order issues**: `( a ) ( b ) op` parsed as `( a ( b op ) )`
- **Known affected tests**: list-creation, standalone-blocks, compile-code-block, drop operations
- **DO NOT SPEND TIME FIXING**: Mark as `.skip()` with "KNOWN ISSUE: test isolation" comment
- **Tests pass with debug output** - heisenbug behavior is normal

### 4. Plan Processing Workflow
1. **Read complete plan** - identify 🎯 **ACTIVE** step and dependencies
2. **Implement incrementally** with testing at each stage
3. **Mark step complete** - get user approval before proceeding
4. **Stop protocol** - don't auto-advance to next phases

### 5. Stack Safety (CRITICAL)
- **Use `vm.ensureStackSize(n, operation)`** before all pops
- **Handle empty stack gracefully** - return NIL for invalid operations
- **Preserve stack integrity** - maintain proper stack contracts

### 6. Code Quality (C-Port Focused)
- **Edit existing files** - never create new files unless required
- **NO COMMENTS** unless requested - follow existing patterns exactly  
- **C-like implementations**: Fixed-size arrays, direct loops, simple functions
- **Avoid JavaScript idioms**: No .map()/.filter(), minimal closures, explicit memory management
- **Single responsibility**: One file per functional area, clear ownership chains
- **SECURITY ONLY** - refuse malicious code assistance

### 7. Operation Implementation Pattern
- **Symbol table registration**: `symbolTable.define('name', Op.Opcode, functionOp)`
- **Opcode dispatch**: Add case in `executeOp` switch statement  
- **Error handling**: Return NIL for invalid inputs, use `vm.ensureStackSize()`
- **Integration testing**: Verify no regressions in 700+ test suite

### 8. LIST Implementation Specifics  
- **Header-at-TOS semantics**: `[payload-n] ... [payload-0] [LIST:n] ← TOS`
- **Address calculation**: `addr = SP - 1 - idx` for slot operations
- **Compound elements**: Use spans for traversal, materialize on fetch
- **Stack effects**: Document as `( before — after )` in all implementations

### 9. C/Assembly Porting Discipline (CRITICAL)
- **This is a PROTOTYPE for future C/assembly port** - all code decisions must support this goal
- **Avoid JavaScript-specific patterns**: No .map()/.filter()/.reduce(), minimize closures, avoid dynamic arrays
- **Prefer C-like patterns**: Direct loops, fixed-size buffers, explicit memory management
- **Single ownership model**: Clear responsibility chains, no circular dependencies
- **Direct function calls**: Minimize abstraction layers, prefer simple dispatch tables
- **Stack-based memory**: All operations must work within 64KB segmented memory model
- **Performance-first**: Cache-friendly data structures (64-byte VM struct), minimal heap allocation

### 10. Code Consolidation Principles
- **Always consolidate duplicates**: Look for scattered functionality and merge into single source
- **Test consolidation works**: We successfully reduced 800+ lines to 302 lines (62% reduction)  
- **Systematic approach**: Update imports, fix API compatibility, verify functionality
- **Mark known issues**: Jest NaN-boxing corruption and test isolation issues are environmental, not implementation defects

### 11. C-Port Specific Coding Standards
- **C-style pseudocode only**: Loops, conditionals; no functional style programming
- **No associative arrays/maps**: Model as contiguous indexed buffers
- **Avoid recursion**: Use iterative forms for better C translation
- **IEEE-754 float32 default**: All numeric values unless explicitly integer-tagged
- **Heap allocation forbidden**: Stack-based memory within 64KB constraints
- **Direct memory management**: Respect segment boundaries, no garbage collection dependencies

## 🏗️ Architecture (64KB VM Constraints)
**Memory Layout**: 64KB total segmented memory (CRITICAL for C port)
- STACK: 16KB (0x0000-0x3FFF) - Main data stack, 32-bit tagged values
- RSTACK: 4KB (0x4000-0x4FFF) - Return stack, call frames  
- CODE: 8KB (0x5000-0x6FFF) - Bytecode storage, 13-bit addresses
- STRING: 36KB (0x7000-0xFFFF) - String storage, segment-relative addressing

**Tagged Values**: NaN-boxed 32-bit values
- Tags: NUMBER(0), INTEGER(1), CODE(2), STRING(4), LIST(5), BUILTIN(7)
- **No LINK tag** - legacy removed, any references are historical
- **Flat serialization** - contiguous slots, no heap pointers

**Execution Model**: Stack-based postfix, bytecode dispatch
- Built-ins: opcodes 0-127 with Tag.BUILTIN
- Colon definitions: bytecode addresses with Tag.CODE  
- Direct addressing: no function table indirection

## 📋 Commands
```bash
yarn test    # MANDATORY after every step
yarn lint    # MANDATORY before completion  
yarn dev     # REPL
```

## 📚 Key Files & Naming Conventions
**File Naming**: Use kebab-case for all files/folders (e.g., `known-issues.md`, `test-utils.ts`)
**Code Naming**: TypeScript conventions - camelCase functions, PascalCase classes, UPPER_SNAKE_CASE constants

**Critical Files**:
- `src/core/vm.ts` - VM implementation (target: <200 lines after Phase 2)
- `src/core/tagged.ts` - NaN-boxing type system
- `docs/specs/*` - Specifications (READ-ONLY, never modify)
- `docs/plans/` - Implementation plans (move to done/ when complete)
- `src/test/utils/vm-test-utils.ts` - Consolidated test utilities (Phase 1 success)

## ❌ Anti-Patterns for C/Assembly Port
- **JavaScript over-engineering**: .map()/.filter()/.reduce(), complex object hierarchies, dynamic typing beyond tagged values
- **Memory anti-patterns**: Heap allocation in hot paths, garbage collection dependencies, unbounded data structures  
- **Architecture anti-patterns**: Circular dependencies, global state, multiple abstraction layers, scattered functionality
- **Testing anti-patterns**: New VM instances in tests, ignoring Jest NaN-boxing issues, creating multiple test utilities
- **General anti-patterns**: Modifying specs, breaking stack contracts, adding unnecessary comments

## ✅ **Proven Successful Patterns** (from Phase 1)
- **Consolidation approach**: Merge 5 duplicate files → 1 unified utility (62% reduction)
- **Systematic migration**: Update all imports, fix API compatibility, verify with tests
- **C-ready error handling**: Simple error codes, direct function returns, no exception hierarchies
- **Test isolation awareness**: Mark Jest/NaN-boxing issues as known environmental problems
- **Single ownership**: One file responsible for each functional area