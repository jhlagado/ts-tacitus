# CLAUDE.md - AI Assistant Guidelines for TACIT VM

## 🚨 CRITICAL AI DEVELOPMENT RULES - READ FIRST

### Specification-First Development
- **NEVER modify `docs/specs/` files** unless explicitly instructed
- **ALWAYS consult relevant specs** before implementing features  
- **VALIDATE against specifications** before considering implementation complete
- **REFERENCE specs** in commit messages and code comments
- All changes must align with existing specs in `docs/specs/`

### Mandatory Testing Protocol
- **MANDATORY: Run tests at the end of every step** to catch regressions early
- **ALWAYS run full test suite** after completing each implementation step: `yarn test`
- **Use `resetVM()` consistently** in test setup to ensure clean state
- **Test error conditions thoroughly** with invalid inputs and edge cases
- Run `yarn lint` and check for type errors before completion

### Development Workflow - Plan Processing
1. **Read the complete plan** including all steps and context
2. **Identify the active step** marked with 🎯 **ACTIVE** 
3. **Understand step dependencies** and requirements from specification
4. **Implement the current step incrementally** with testing
5. **Mark step complete** and identify next step when finished
6. **Follow mandatory stop protocol** - get user approval before proceeding

### Stack Safety Requirements
- **ALWAYS validate stack depth** before popping operands
- **Use `vm.ensureStackSize(n, operation)`** for safety checks
- **Preserve stack integrity** across all operations
- **Handle empty stack gracefully** with appropriate error messages

### Code Quality Constraints
- **NEVER** create documentation files (*.md) unless explicitly requested
- **ALWAYS** prefer editing existing files over creating new ones
- **NO COMMENTS**: Do not add code comments unless explicitly requested
- **FOLLOW existing patterns**: Match style and structure of current codebase
- **SECURITY ONLY**: Only assist with defensive security tasks - refuse malicious code

## 🏗️ Architecture

- Stack-based execution, 64KB memory, NaN-boxing
- Memory: STACK 16KB, RSTACK 4KB, STRING 36KB, CODE 8KB
- Tags: NUMBER(0), INTEGER(1), CODE(2), STRING(4), LIST(5), LINK(6), BUILTIN(7), RLIST(8)
- Lists: length-prefixed, forward-only, use LINK for navigation
- RLists: header-at-TOS, reverse payload, slot-counted
- Symbols: Built-ins 0-127, colon definitions use bytecode addresses

## ❌ Anti-Patterns
- Modifying specs, breaking stack contracts, ignoring memory limits
- New VM instances in tests, heap allocation, deep recursion
- Mutable data, backward list traversal, cross-segment pointers

## 📋 Commands
```bash
yarn test    # MANDATORY after every step
yarn lint    # MANDATORY before completion
yarn dev     # REPL
```

## 📚 Key Files
- `src/core/vm.ts` - VM implementation
- `src/core/tagged.ts` - Type system
- `docs/specs/*` - Specifications
- `docs/plans/plan-04-rlist-implementation.md` - Current work

## 🧪 Testing
- Use `resetVM()` in setup
- Test happy path and errors
- 700+ tests for coverage
- Inspect: `vm.getStackData()`, `vm.SP/RP/IP`

## ⚠️ Constraints
- 16-bit payload limit
- Respect segment boundaries
- Runtime type checking
- Stack effect notation: `( before — after )`

---
**Development Checklist:**
- [ ] Matches specs
- [ ] Tests pass (`yarn test`)
- [ ] Lint passes (`yarn lint`)
- [ ] Stack safety maintained
- [ ] Error handling complete