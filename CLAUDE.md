# CLAUDE.md - AI Assistant Guidelines for TACIT VM

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
- **Jest NaN-boxing corruption**: Intermittent `isList()` failures with valid LIST tags
- **Parsing order issues**: `( a ) ( b ) op` parsed as `( a ( b op ) )`  
- **Mark as test isolation issues** - not implementation defects
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

### 6. Code Quality
- **Edit existing files** - never create new files unless required
- **NO COMMENTS** unless requested - follow existing patterns exactly
- **Match codebase style** - imports, structure, naming conventions
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

## 🏗️ Architecture
- Stack-based, 64KB memory, NaN-boxing
- STACK 16KB, RSTACK 4KB, STRING 36KB, CODE 8KB  
- Tags: NUMBER(0), INTEGER(1), CODE(2), STRING(4), LIST(5), LINK(6), BUILTIN(7), RLIST(8)

## 📋 Commands
```bash
yarn test    # MANDATORY after every step
yarn lint    # MANDATORY before completion  
yarn dev     # REPL
```

## 📚 Key Files
- `src/core/vm.ts` - VM implementation
- `src/core/tagged.ts` - Type system
- `docs/specs/*` - Specifications (READ-ONLY)
- `docs/plans/` - Implementation plans

## ❌ Anti-Patterns
- Modifying specs, breaking stack contracts, new VM instances in tests
- Creating new files unnecessarily, adding comments without request
- Ignoring Jest test isolation issues (mark as known issues instead)