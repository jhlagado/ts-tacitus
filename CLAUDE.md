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

## 🏗️ TACIT VM Architecture (Quick Reference)

### Core Principles
- **Stack-based execution** with postfix notation
- **64KB total memory** with fixed segment layout
- **32-bit tagged values** using NaN-boxing technique
- **Immutable data structures** - no in-place modification of lists
- **Left-to-right evaluation** - all operations process arguments in order

### Memory Layout
```
Total: 64KB (65536 bytes)
├── STACK:  16KB (0x0000-0x3FFF) - Main data stack
├── RSTACK:  4KB (0x4000-0x4FFF) - Return stack  
├── STRING: 36KB (0x5000-0xDFFF) - String storage
└── CODE:    8KB (0xE000-0xFFFF) - Bytecode storage
```
*Reference: [`docs/specs/vm-architecture.md`](docs/specs/vm-architecture.md)*

### Tagged Value System
```typescript
enum Tag {
  NUMBER = 0,      // IEEE 754 float
  INTEGER = 1,     // 16-bit signed integer  
  CODE = 2,        // Bytecode address
  STRING = 4,      // String segment reference
  LIST = 5,        // List length header
  LINK = 6,        // Stack-only backward pointer
  BUILTIN = 7,     // Built-in operation opcode
}
```
- **NaN-Boxing**: 6-bit tag + 16-bit payload in 32-bit float
- **16-bit Value Limit**: All tagged values limited to 16-bit payload (0-65535)
- **Type Safety**: Runtime type checking via tag inspection
*Reference: [`docs/specs/tagged.md`](docs/specs/tagged.md)*

## 🔧 Implementation Rules

### Symbol System Constraints
- **Built-ins use opcodes 0-127** with `Tag.BUILTIN`
- **Colon definitions use bytecode addresses** with `Tag.CODE` 
- **Symbol table provides direct addressing** for unified dispatch
- **@ prefix creates code references** without execution
- **Direct bytecode addressing** without function table indirection

### List System Rules
- **Length-prefixed structures** starting with `LIST:n` header
- **Elements follow in order** after header
- **LINK tags are stack-only** and not serialized
- **Forward traversal only** - never traverse lists backward
- **ALWAYS use LINK** to find list start for safe navigation
- **Flat serialization** without nested pointers
*Reference: [`docs/specs/lists.md`](docs/specs/lists.md)*

### Memory Management Rules
- **Respect segment boundaries** in VM memory layout
- **Use tagged values consistently** for type safety
- **Avoid memory leaks** in string and list operations
- **Test memory edge cases** like overflow and underflow

## ❌ CRITICAL ANTI-PATTERNS TO AVOID

### Implementation Anti-Patterns
- ❌ **Modifying specs** without explicit instruction
- ❌ **Breaking stack effect contracts** without updating documentation
- ❌ **Ignoring memory constraints** in VM design
- ❌ **Creating new VM instances** in tests (use global `vm`)
- ❌ **Heap allocation** for temporary data structures
- ❌ **Deep recursion** that could overflow call stack

### Testing Anti-Patterns
- ❌ **Testing implementation details** instead of behavior
- ❌ **Forgetting `resetVM()` in test setup**
- ❌ **Not testing error conditions**
- ❌ **Hardcoding magic numbers** instead of using constants
- ❌ **Skipping full test suite** after changes

### Design Anti-Patterns
- ❌ **Mutable data structures** that break functional semantics
- ❌ **String manipulation** without proper segment management
- ❌ **Backward list traversal** (violates LINK navigation rules)
- ❌ **Cross-segment pointer arithmetic**

## 📋 Essential Commands

### Development
```bash
yarn dev                     # Start REPL
yarn build                   # Compile TypeScript  
yarn start                   # Run compiled CLI
```

### Quality Assurance (MANDATORY)
```bash
yarn test                    # Run full test suite (REQUIRED after every step)
yarn lint                    # Check code style (REQUIRED before completion)
yarn test:coverage          # Coverage report
yarn test:watch             # Watch mode for development
```

## 🎯 Language Features Quick Reference

### Basic Syntax
```tacit
# Stack effect notation: ( before — after )
42 3.14 +                    # ( n1 n2 — sum )
: square dup * ;             # Define word: ( n — n² )
( 1 2 3 )                    # Create list: ( — list )
@add                         # Symbol reference: ( — @add )
```

### Control Structures
```tacit
# Conditional execution
5 3 > IF { "greater" print } ELSE { "not greater" print }

# Code blocks
{ 1 + } 5 do                 # Apply block: ( n block — result )
{ dup print } 3 repeat       # Execute N times: ( block n — )
```

## 📚 Key File Locations

### Core Implementation
- `src/core/vm.ts` - Virtual machine implementation
- `src/core/tagged.ts` - NaN-boxing and type system  
- `src/core/memory.ts` - Segmented memory management
- `src/lang/parser.ts` - Language parsing and compilation
- `src/ops/builtins.ts` - Operation dispatch and execution

### Critical Documentation
- [`docs/rules/ai-guidelines.md`](docs/rules/ai-guidelines.md) - **READ THIS FIRST**
- [`docs/specs/vm-architecture.md`](docs/specs/vm-architecture.md) - Memory and execution model
- [`docs/specs/tagged.md`](docs/specs/tagged.md) - Type system specification
- [`docs/specs/lists.md`](docs/specs/lists.md) - List structure and navigation
- [`docs/specs/capsules-implementation.md`](docs/specs/capsules-implementation.md) - @Symbol system

### Development Process
- [`docs/tasks/done/`](docs/tasks/done/) - Completed development tasks
- [`docs/tasks/plan-04-capsules-implementation.md`](docs/tasks/plan-04-capsules-implementation.md) - Current work
- [`docs/reference/glossary.md`](docs/reference/glossary.md) - TACIT terminology

## 🧪 Testing Strategy

### Test Organization
```
src/test/
├── core/           # VM, memory, tagged values
├── lang/           # Parser, compiler, tokenizer
├── ops/            # Operations by category  
├── integration/    # Cross-component tests
└── utils/          # Test utilities and helpers
```

### Testing Requirements (MANDATORY)
- **Test the happy path** with expected inputs and outputs
- **Test error conditions** with invalid inputs and edge cases
- **Test integration** between different VM components
- **Use `resetVM()` consistently** in test setup
- **Run full test suite after every implementation step**
- **700+ tests** provide comprehensive coverage

## 🔍 VM State Inspection (Debugging)

### Stack and Memory
```typescript
vm.getStackData()            // Current stack contents
vm.getCompileData()          // Compiled bytecode
vm.SP, vm.RP, vm.IP          // Pointer states
vm.memory.dump(start, end)   // Memory inspection
```

### Error Handling
- **Provide clear error messages** with context and stack state
- **Use appropriate error types** (StackUnderflow, TypeError, etc.)
- **Test error conditions thoroughly**
- **Maintain VM consistency** even after errors

## 📖 Communication Guidelines

### Stack Effect Documentation
- **Use `( before — after )` format consistently**
- **Document constraints** and assumptions
- **Include examples** for non-obvious behavior
- **Reference relevant specifications** for complex logic

### Commit Message Format
- **Reference spec files** that guided implementation
- **Explain what changed** and why
- **Note any constraints** or limitations  
- **Include test status** (passing/failing)

## ⚠️ Common Pitfalls

### Memory Constraints
- **16-bit Limit**: All tagged values limited to 16-bit payload
- **Stack Overflow**: Monitor stack usage in deep recursion
- **Segment Bounds**: Respect segment boundaries in memory operations

### List Operations
- **Backward Traversal**: Never traverse lists backward
- **LINK Dependency**: Always use LINK to find list start
- **Nesting**: Nested lists require careful LINK management

### Type Safety
- **Tag Validation**: Always validate tags before operations
- **Conversion**: Use proper tagged value conversion functions
- **Runtime Checks**: Rely on runtime type checking

---

## 📋 Development Checklist (Use Before Completion)

- [ ] Implementation matches specification requirements
- [ ] All edge cases have test coverage  
- [ ] Stack effects documented and correct
- [ ] Memory usage respects constraints
- [ ] Error handling is comprehensive
- [ ] **MANDATORY: `yarn test` passes completely**
- [ ] **MANDATORY: `yarn lint` passes without errors**
- [ ] No new documentation files created without request
- [ ] Existing code patterns followed
- [ ] VM state remains consistent

---

*This file serves as the primary reference for AI assistants working on the TACIT VM project. The rules at the top are MANDATORY and must be followed for all development work. Refer to linked documentation for detailed specifications.*