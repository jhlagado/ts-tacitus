# Testing Patterns and Standards for ts-tacitus

## Core Testing Principles

### 1. **ALWAYS Research Existing Patterns First**
- **NEVER innovate or reinvent testing wheels**
- Do exhaustive search of existing test patterns before writing new tests
- Study imports, structure, assertions, and organization of similar tests
- Follow established patterns exactly - consistency is critical

### 2. **Test Organization Hierarchy**

```
src/test/
├── core/           # VM core functionality (tagged values, VM, memory)
├── ops/            # Operations organized by functional category
│   ├── arithmetic/ # Math operations (add, multiply, etc.)
│   ├── comparison/ # Comparison operations (gt, eq, etc.)
│   ├── conditional/# Control flow (if/else)
│   ├── interpreter/# Core interpreter ops (eval, call, exit)
│   ├── lists/      # List manipulation operations
│   ├── print/      # Output operations
│   ├── stack/      # Stack manipulation (dup, swap, etc.)
│   └── strings/    # String operations
├── lang/           # Language-level (parser, tokenizer, compiler)
├── integration/    # End-to-end integration tests
├── utils/          # Testing utilities and frameworks
└── debug/          # Debug-specific functionality
```

**Consolidation Rules:**
- Group related functionality in the same test file
- Add new tests to existing files when testing same operations
- Only create new files for genuinely new functional categories

## Standard Test File Structure

### Import Patterns (CRITICAL - Follow Exactly)
```typescript
// 1. Always use vm from globalState, NEVER new VM()
import { vm } from '../../core/globalState';

// 2. Always use resetVM from test-utils
import { resetVM } from '../utils/test-utils';

// 3. Import specific operations being tested
import { dupOp, swapOp } from '../../ops/builtins-stack';

// 4. Import types and utilities as needed
import { Tag, toTaggedValue } from '../../core/tagged';
import { Op } from '../../ops/opcodes';
```

### Standard Test Structure Template
```typescript
describe('Operation/Feature Name', () => {
  beforeEach(() => {
    resetVM(); // ALWAYS use resetVM(), not initializeInterpreter()
  });

  describe('simple values', () => {
    test('should handle basic case', () => {
      vm.push(5);
      operationOp(vm);
      expect(vm.getStackData()).toEqual([expected]);
    });
  });

  describe('list operations', () => {
    // List-specific behavior tests
  });

  describe('error cases', () => {
    test('should handle stack underflow', () => {
      expect(() => operationOp(vm)).toThrow('Stack underflow');
    });
  });
});
```

## Testing Levels and Patterns

### Level 1: Unit Tests (Direct VM Operations)
**Pattern:** Direct VM manipulation + single operation + stack assertion
```typescript
test('should execute built-in add operation', () => {
  vm.push(2);
  vm.push(3);
  addOp(vm);
  expect(vm.getStackData()).toEqual([5]);
});
```

### Level 2: Integration Tests (Language Code)
**Pattern:** Tacit code execution + stack result verification
```typescript
test('arithmetic operations', () => {
  const result = runTacitTest('5 3 add');
  expect(result).toEqual([8]);
});
```

### Level 3: End-to-End Tests (Full Language Features)
**Pattern:** Complex Tacit programs + behavior verification
```typescript
test('word quoting with back-tick', () => {
  const result = runTacitTest(': testWord 42 ; `testWord');
  expect(result.length).toBe(1);
  expect(typeof result[0]).toBe('number');
});
```

## Core Testing Utilities

### Essential Functions from test-utils.ts
```typescript
// VM State Management
resetVM()                                    // Complete VM reset for isolated tests - ALWAYS use this

// Stack State Inspection
vm.getStackData()                            // Returns number[] of current stack contents
vm.getStackData().length                     // Get current stack depth/size

// Code Execution
executeTacitCode(code: string): number[]     // Execute Tacit code, return stack
runTacitTest(code: string): number[]         // Alias for executeTacitCode
testTacitCode(code, expected)                // Execute + comprehensive assertion

// Output Testing
captureTacitOutput(code: string): string[]   // Capture console output for print tests

// Batch Testing
runOperationTests(testCases[])               // Batch test runner for operation patterns

// Advanced Verification
toBeCloseToArray(received[], expected[], precision) // Floating-point array comparison
verifyListStructure(stack, expectList)       // Complex list structure verification
```

## Standard Assertion Patterns

### Stack State Verification
```typescript
// PREFERRED: Full stack comparison using vm.getStackData()
expect(vm.getStackData()).toEqual([1, 2, 3]);

// Stack depth checking: vm.getStackData().length
expect(vm.getStackData().length).toBe(3);

// Empty stack verification
expect(vm.getStackData()).toEqual([]);
expect(vm.getStackData().length).toBe(0);

// AVOID: Manual pop operations (harder to debug, destructive)
expect(vm.pop()).toBe(3);
expect(vm.pop()).toBe(2);
```

### VM State Verification
```typescript
// Return stack preservation (for built-in operations)
const originalRP = vm.RP;
// ... execute operation
expect(vm.RP).toBe(originalRP);  // Return stack unchanged

// IP preservation checks
const originalIP = vm.IP;
// ... execute operation  
expect(vm.IP).toBe(originalIP);  // IP should be restored

// Call frame verification
const originalBP = vm.BP;
// ... execute code block
expect(vm.BP).toBe(originalBP);  // BP should be restored
```

### Error Testing
```typescript
// Include specific error messages when possible
expect(() => operationOp(vm)).toThrow('Stack underflow');

// For complex errors, test the full message
expect(() => dupOp(vm)).toThrow(
  `Stack underflow: 'dup' requires 1 operand (stack: ${JSON.stringify(vm.getStackData())})`
);
```

### Tagged Value Testing
```typescript
// Create tagged values consistently using utility functions
const builtinRef = createBuiltinRef(Op.Add);      // Use utilities when available
const codeRef = createCodeRef(1000);              // Use utilities when available
const manualRef = toTaggedValue(Op.Add, Tag.BUILTIN); // Manual creation when needed

vm.push(builtinRef);

// Test tag extraction
const { tag, value } = fromTaggedValue(stackValue);
expect(tag).toBe(Tag.BUILTIN);
expect(value).toBe(Op.Add);

// Test utility functions
expect(isBuiltinRef(builtinRef)).toBe(true);
expect(isCodeRef(codeRef)).toBe(true);
expect(getBuiltinOpcode(builtinRef)).toBe(Op.Add);
```

## VM-Level Testing Patterns

### Manual Operation Testing (No Language Required)
```typescript
// Direct VM operation testing - bypasses parser/compiler
test('should execute manual Tag.BUILTIN operations', () => {
  vm.push(2);
  vm.push(3);
  vm.push(createBuiltinRef(Op.Add));
  
  evalOp(vm);  // Direct VM dispatch
  
  expect(vm.getStackData()).toEqual([5]);
});

// Test sequences of operations
test('should handle operation sequences', () => {
  vm.push(2);
  vm.push(3);
  vm.push(createBuiltinRef(Op.Add));
  evalOp(vm);
  
  vm.push(createBuiltinRef(Op.Dup));
  evalOp(vm);
  
  expect(vm.getStackData()).toEqual([5, 5]);
});
```

### Batch Testing with forEach
```typescript
test('should handle multiple operations', () => {
  const testCases = [
    { opcode: Op.Add, inputs: [2, 3], expected: [5] },
    { opcode: Op.Dup, inputs: [42], expected: [42, 42] },
    { opcode: Op.Swap, inputs: [1, 2], expected: [2, 1] },
  ];

  testCases.forEach(({ opcode, inputs, expected }) => {
    resetVM();  // Fresh state for each test
    
    inputs.forEach(input => vm.push(input));
    vm.push(createBuiltinRef(opcode));
    evalOp(vm);
    
    expect(vm.getStackData()).toEqual(expected);
  });
});
```

### Non-Executable Value Testing
```typescript
test('should handle non-executable values correctly', () => {
  const nonExecutableValues = [
    42,                                    // Plain number
    toTaggedValue(100, Tag.STRING),       // String reference
    toTaggedValue(5, Tag.LIST),           // List reference
  ];

  nonExecutableValues.forEach(value => {
    resetVM();
    vm.push(value);
    
    evalOp(vm);  // Should push back non-executable values
    
    expect(vm.getStackData()).toEqual([value]);
  });
});
```

### Performance and State Verification
```typescript
test('should execute without side effects', () => {
  const originalRP = vm.RP;
  const originalIP = vm.IP;
  
  vm.push(2);
  vm.push(3);
  vm.push(createBuiltinRef(Op.Add));
  evalOp(vm);
  
  expect(vm.RP).toBe(originalRP);  // Return stack unchanged
  expect(vm.IP).toBe(originalIP);  // IP unchanged for built-ins
  expect(vm.getStackData()).toEqual([5]);
});
```

### List Testing Patterns
```typescript
test('should handle list operations', () => {
  const listTag = toTaggedValue(3, Tag.LIST);
  const linkTag = toTaggedValue(4, Tag.LINK);

  vm.push(listTag);
  vm.push(10);
  vm.push(20);
  vm.push(30);
  vm.push(linkTag);

  operationOp(vm);

  // Verify list structure preserved
  expect(vm.pop()).toBe(linkTag);
  expect(vm.pop()).toBe(30);
  // ... etc
});
```

### Output Capture Testing
```typescript
test('should print values correctly', () => {
  const output = captureTacitOutput('123 print');
  expect(output).toEqual(['123']);
});
```

## Error Handling Best Practices

### Comprehensive Error Testing
- **Stack underflow/overflow** for all stack operations
- **Type validation** for tagged values
- **Boundary conditions** for edge cases
- **Specific error messages** verification

### Error Test Examples
```typescript
describe('error cases', () => {
  test('should handle empty stack', () => {
    expect(() => evalOp(vm)).toThrow('Stack underflow');
  });

  test('should handle stack overflow', () => {
    // Fill stack to capacity
    for (let i = 0; i < STACK_SIZE / 4; i++) {
      vm.push(i);
    }
    expect(() => vm.push(42)).toThrow('Stack overflow');
  });
});
```

## Test Categories and Describe Blocks

### Standard Nested Structure
```typescript
describe('Operation Name', () => {
  describe('simple values', () => {
    // Basic functionality tests
  });

  describe('list operations', () => {
    // List-specific behavior
  });

  describe('complex scenarios', () => {
    // Multi-step operations
  });

  describe('error cases', () => {
    // Error handling and edge cases
  });
});
```

### Integration Test Structure
```typescript
describe('Feature Integration', () => {
  describe('basic operations', () => {
    // Simple integration scenarios
  });

  describe('complex workflows', () => {
    // Multi-operation sequences
  });

  describe('language features', () => {
    // Parser/compiler integration
  });
});
```

## Common Anti-Patterns to AVOID

### ❌ Wrong Patterns
```typescript
// DON'T: Create new VM instances
const vm = new VM();

// DON'T: Use non-existent methods
expect(vm.stackSize()).toBe(1);       // stackSize() doesn't exist
expect(vm.clearStack()).toBeUndefined(); // clearStack() doesn't exist
vm.compile8(Op.Add);                  // compile8() doesn't exist on vm

// DON'T: Manual pop chains for verification (destructive)
expect(vm.pop()).toBe(3);
expect(vm.pop()).toBe(2);

// DON'T: Inconsistent test naming
it('should work with stuff', () => { ... });

// DON'T: Skip resetVM() in forEach loops
testCases.forEach(() => {
  // Missing resetVM() call - tests will interfere
});

// DON'T: Assume opcodes without checking
expect(createBuiltinRef(Op.Subtract)).toBeDefined(); // Op.Subtract doesn't exist

// DON'T: Forget to import utilities
import { toTaggedValue } from '../../core/tagged';
// Missing: import { createBuiltinRef } from '../../core/code-ref';
```

### ✅ Correct Patterns
```typescript
// DO: Use global vm instance
import { vm } from '../../core/globalState';

// DO: Use getStackData() for verification
expect(vm.getStackData()).toEqual([2, 3]);

// DO: Use getStackData().length for stack depth
expect(vm.getStackData().length).toBe(2);

// DO: Always reset VM state
beforeEach(() => {
  resetVM();
});

// DO: Reset VM in forEach when testing multiple cases
testCases.forEach(({ opcode, inputs, expected }) => {
  resetVM();  // Fresh state for each test case
  // ... test logic
});

// DO: Use utility functions for tagged values
const builtinRef = createBuiltinRef(Op.Add);  // Use utilities
const codeRef = createCodeRef(1000);          // Use utilities

// DO: Verify actual opcode names
expect(createBuiltinRef(Op.Minus)).toBeDefined(); // Op.Minus exists (not Op.Subtract)

// DO: Import all needed utilities
import { vm } from '../../core/globalState';
import { resetVM } from '../utils/test-utils';
import { createBuiltinRef } from '../../core/code-ref';
import { evalOp } from '../../ops/builtins-interpreter';

// DO: Use consistent test naming
test('should execute built-in Add operation directly', () => {
```

## File Location Guidelines

### When to Create New Test Files
- **New operation category** (e.g., new `/ops/category/`)
- **Genuinely different functionality** that doesn't fit existing categories
- **Different abstraction level** (core vs ops vs lang vs integration)

### When to Add to Existing Files
- **Testing same operation** with new functionality (like Tag.BUILTIN for evalOp)
- **Related operations** in same category
- **Additional edge cases** for existing functionality

### Consolidation Examples
```
❌ Before: /test/ops/eval-builtin.test.ts (standalone)
✅ After:  /test/ops/interpreter/interpreter-operations.test.ts (consolidated)
```

## Documentation Standards

### Test File Headers
```typescript
/**
 * @file src/test/category/feature.test.ts
 * 
 * Clear description of what functionality is being tested.
 * Include any special testing considerations or setup requirements.
 */
```

### Test Descriptions
- Use clear, behavior-focused descriptions
- Include the specific functionality being tested
- Avoid technical jargon in favor of clear intent

## Quick Reference Checklist

Before writing any test:
- [ ] Searched for existing patterns in similar tests
- [ ] Using correct import patterns (vm from globalState, resetVM, etc.)
- [ ] Following established directory organization
- [ ] Using consistent describe/test structure
- [ ] Including resetVM() in beforeEach
- [ ] Using vm.getStackData() for assertions, not vm.pop() chains
- [ ] Testing error cases appropriately
- [ ] Consolidating with existing tests when appropriate
- [ ] Using utility functions (createBuiltinRef, createCodeRef) when available
- [ ] Verifying actual opcode names (Op.Minus not Op.Subtract)
- [ ] Resetting VM state in forEach loops for independent test cases

## Key Lessons Learned

### Critical Anti-Patterns to NEVER Repeat
1. **NEVER assume method names exist** - always check VM API first
2. **NEVER use new VM()** - always use global vm from globalState  
3. **NEVER chain vm.pop() calls** - use vm.getStackData() for verification
4. **NEVER skip resetVM()** - especially in forEach loops
5. **NEVER assume opcode names** - check Op enum (Op.Minus not Op.Subtract)

### Essential VM Testing Knowledge
```typescript
// Stack inspection (READ-ONLY)
vm.getStackData()           // Returns number[] - current stack contents
vm.getStackData().length    // Stack depth/size
vm.getStackData().toEqual([]) // Empty stack check

// VM state inspection
vm.RP, vm.IP, vm.BP         // Return stack, instruction, base pointers
vm.SP                       // Stack pointer

// Essential utilities
resetVM()                   // Complete state reset
createBuiltinRef(Op.Add)    // Create Tag.BUILTIN references
createCodeRef(1000)         // Create Tag.CODE references
evalOp(vm)                  // Direct VM dispatch testing
```

This document serves as the definitive guide for maintaining consistency and quality in the ts-tacitus test suite.
