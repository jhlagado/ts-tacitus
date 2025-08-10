# AI Development Guidelines for TACIT

## Core Principles

### Specification-First Development
- **Never modify `specs/` files** unless explicitly instructed
- **Always consult relevant specs** before implementing features
- **Validate against specifications** before considering implementation complete
- **Reference specs in commit messages** and code comments

### TACIT Language Conventions  
- **Stack effect notation**: Use `( before — after )` format consistently
- **Left-to-right evaluation**: All operations process arguments in order
- **Immutable data structures**: No in-place modification of lists or capsules
- **Type safety**: Preserve tagged value semantics across all operations

### Code Quality Standards
- **Follow existing patterns**: Match style and structure of current codebase  
- **Comprehensive testing**: Unit tests, integration tests, and error cases
- **Clear documentation**: Explain stack effects, constraints, and edge cases
- **Performance awareness**: Consider memory usage and execution efficiency

### Pseudocode Style Rule
- Use only C-style, structured pseudocode (loops, conditionals; no functional style)
- Do not use associative arrays/maps or assume a heap; model arrays as contiguous indexed buffers
- Avoid recursion where iterative forms suffice
- Write pseudocode that can be implemented directly in low-level languages (C/assembly)

## Implementation Rules

### Stack Operations
- **Always validate stack depth** before popping operands
- **Use `vm.ensureStackSize(n, operation)`** for safety checks
- **Preserve stack integrity** across all operations
- **Handle empty stack gracefully** with appropriate error messages

### Memory Management
- **Respect segment boundaries** in VM memory layout
- **Use tagged values consistently** for type safety
- **Avoid memory leaks** in string and list operations
- **Test memory edge cases** like overflow and underflow

### Testing Requirements
- **Test the happy path** with expected inputs and outputs
- **Test error conditions** with invalid inputs and edge cases  
- **Test integration** between different VM components
- **Use `resetVM()` consistently** in test setup to ensure clean state
- **Always run full test suite** after completing each implementation step
- **MANDATORY: Run tests at the end of every step** to catch regressions early
- **Use yarn for all package management** and test execution commands

## Architectural Constraints

### VM Design
- **64KB total memory** with fixed segment layout
- **32-bit tagged values** using NaN-boxing technique
- **Stack-based execution** with postfix notation
- **Direct bytecode addressing** without function table indirection

### Symbol System
- **Built-ins use opcodes 0-127** with `Tag.BUILTIN`
- **Colon definitions use bytecode addresses** with `Tag.CODE`
- **Symbol table provides direct addressing** for unified dispatch
- **@ prefix creates code references** without execution

### List Format
- **Length-prefixed structures** starting with `LIST:n` header
- **Elements follow in order** after header
- **LINK tags are stack-only** and not serialized
- **Flat serialization** without nested pointers

## Development Workflow

### Plan Processing
1. **Read the complete plan** including all steps and context
2. **Identify the active step** marked with 🎯 **ACTIVE**
3. **Understand step dependencies** and requirements from specification
4. **Implement the current step incrementally** with testing
5. **Mark step complete** and identify next step when finished
6. **Follow mandatory stop protocol** - get user approval before proceeding

### Multi-Step Plan Management
- **Keep related steps together** in numbered plan files
- **Maintain step sequence context** for complex implementations
- **Move entire plans to done/** when all steps complete
- **Reference step numbers** in commits and documentation

### Error Handling
- **Provide clear error messages** with context and stack state
- **Use appropriate error types** (StackUnderflow, TypeError, etc.)
- **Test error conditions thoroughly** 
- **Maintain VM consistency** even after errors

### Code Review Checklist
- [ ] Implementation matches specification requirements
- [ ] All edge cases have test coverage
- [ ] Stack effects documented and correct
- [ ] Memory usage is appropriate
- [ ] Error handling is comprehensive
- [ ] Performance is acceptable

## Communication Guidelines

### Code Comments
- **Explain stack effects** for all operations
- **Document constraints** and assumptions
- **Reference relevant specifications** for complex logic
- **Include examples** for non-obvious behavior

### Commit Messages
- **Reference spec files** that guided implementation
- **Explain what changed** and why
- **Note any constraints** or limitations
- **Include test status** (passing/failing)

### Documentation Updates
- **Keep specs synchronized** with implementation
- **Update test cases** when behavior changes
- **Maintain glossary** with new terms
- **Document performance characteristics**

## Anti-Patterns to Avoid

### Implementation Anti-Patterns
- ❌ **Modifying specs** without explicit instruction
- ❌ **Breaking stack effect contracts** without updating documentation
- ❌ **Ignoring memory constraints** in VM design
- ❌ **Creating new VM instances** in tests (use global `vm`)

### Testing Anti-Patterns  
- ❌ **Testing implementation details** instead of behavior
- ❌ **Forgetting `resetVM()` in test setup**
- ❌ **Not testing error conditions**
- ❌ **Hardcoding magic numbers** instead of using constants

### Design Anti-Patterns
- ❌ **Heap allocation** for temporary data structures
- ❌ **Mutable data structures** that break functional semantics
- ❌ **Deep recursion** that could overflow call stack
- ❌ **String manipulation** without proper segment management
