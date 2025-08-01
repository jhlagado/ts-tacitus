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
resetVM()                                    // Complete VM reset for isolated tests

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
// PREFERRED: Full stack comparison
expect(vm.getStackData()).toEqual([1, 2, 3]);

// AVOID: Manual pop operations (harder to debug)
expect(vm.pop()).toBe(3);
expect(vm.pop()).toBe(2);
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
// Create tagged values consistently
const builtinRef = toTaggedValue(Op.Add, Tag.BUILTIN);
vm.push(builtinRef);

// Test tag extraction
const { tag, value } = fromTaggedValue(stackValue);
expect(tag).toBe(Tag.BUILTIN);
expect(value).toBe(Op.Add);
```

## Complex Data Structure Testing

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

// DON'T: Use stackSize() (doesn't exist)
expect(vm.stackSize()).toBe(1);

// DON'T: Manual pop chains for verification
expect(vm.pop()).toBe(3);
expect(vm.pop()).toBe(2);

// DON'T: Inconsistent test naming
it('should work with stuff', () => { ... });

// DON'T: Skip resetVM()
beforeEach(() => {
  // Missing resetVM() call
});
```

### ✅ Correct Patterns
```typescript
// DO: Use global vm instance
import { vm } from '../../core/globalState';

// DO: Use getStackData() for verification
expect(vm.getStackData()).toEqual([2, 3]);

// DO: Always reset VM state
beforeEach(() => {
  resetVM();
});

// DO: Use consistent test naming
test('should execute built-in add operation via Tag.BUILTIN', () => {
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
- [ ] Using vm.getStackData() for assertions
- [ ] Testing error cases appropriately
- [ ] Consolidating with existing tests when appropriate

This document serves as the definitive guide for maintaining consistency and quality in the ts-tacitus test suite.
