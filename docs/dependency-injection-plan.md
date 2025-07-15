# Dependency Injection Plan for Tacit VM

## 1. Current Architecture Analysis

### 1.1 Global State Pattern
- The VM is instantiated as a global singleton in `globalState.ts` and accessed throughout the codebase
- Direct access to the VM instance via `import { vm } from '../core/globalState'`
- Initialization happens automatically when the module is imported

### 1.2 Direct Dependencies
- The VM directly creates and manages its dependencies:
  - Memory (for segmented memory model)
  - SymbolTable (for operation registration)
  - Digest (for string interning)
- Dependencies are tightly coupled to the VM implementation

### 1.3 Circular Dependencies
- Circular dependency between VM and Compiler is resolved through delayed initialization
- VM creates Compiler, then Compiler is injected back into VM via `initializeCompiler`

### 1.4 Operation Implementation
- Operations are implemented as standalone functions that take a VM instance as their first parameter
- Example: `export const addOp = (vm: VM) => { ... }`
- Operations directly access VM methods and properties

### 1.5 Registration Mechanism
- Operations are registered in the VM's symbol table through the `registerBuiltins` function
- Registration maps operation names to opcode values and implementation functions

## 2. Dependency Injection Goals

### 2.1 Improve Testability
- Make it easier to test components in isolation with mocked dependencies
- Allow testing operations without a full VM instance
- Support testing error conditions and edge cases

### 2.2 Enhance Modularity
- Reduce coupling between components
- Make dependencies explicit and configurable
- Support alternative implementations of core components

### 2.3 Clarify Dependencies
- Make dependencies explicit rather than implicit
- Document component relationships clearly
- Improve code readability and maintainability

### 2.4 Maintain Compatibility
- Minimize changes to existing code to avoid breaking changes
- Provide migration paths for existing code
- Support backward compatibility during transition

### 2.5 Support Multiple VM Instances
- Allow multiple VM instances to coexist without global state
- Enable isolated execution environments
- Support testing scenarios with multiple VMs

## 3. Proposed Architecture

### 3.1 Core Interfaces

Define interfaces for all major components:

```typescript
// src/core/interfaces.ts
export interface IMemory {
  read8(segment: number, offset: number): number;
  read16(segment: number, offset: number): number;
  readFloat32(segment: number, offset: number): number;
  write8(segment: number, offset: number, value: number): void;
  write16(segment: number, offset: number, value: number): void;
  writeFloat32(segment: number, offset: number, value: number): void;
  // ... other memory methods
}

export interface IDigest {
  intern(str: string): number;
  lookup(address: number): string;
  // ... other digest methods
}

export interface ISymbolTable {
  define(name: string, opcode: number, implementation: Verb): void;
  findImplementationByOpcode(opcode: number): Verb | undefined;
  // ... other symbol table methods
}

export interface IVM {
  // Stack operations
  push(value: number): void;
  pop(): number;
  peek(): number;
  rpush(value: number): void;
  rpop(): number;
  ensureStackSize(size: number, operation: string): void;
  
  // Memory access
  memory: IMemory;
  
  // Pointers
  IP: number;
  SP: number;
  RP: number;
  BP: number;
  
  // State
  running: boolean;
  
  // Symbol table
  symbolTable: ISymbolTable;
  
  // Other methods
  eval(): void;
  reset(): void;
  // ... other VM methods
}

// Operation type definition
export type Verb = (vm: IVM) => void;
```

### 3.2 VM Factory and Configuration

Create a factory for VM instances with dependency injection:

```typescript
// src/core/vm-factory.ts
import { IVM, IMemory, IDigest, ISymbolTable } from './interfaces';
import { VM } from './vm';
import { Memory } from './memory';
import { Digest } from '../strings/digest';
import { SymbolTable } from '../strings/symbol-table';
import { Compiler } from '../lang/compiler';
import { registerBuiltins } from '../ops/builtins-register';

export interface VMConfig {
  memory?: IMemory;
  digest?: IDigest;
  symbolTable?: ISymbolTable;
  registerOperations?: boolean;
}

export class VMFactory {
  /**
   * Creates a new VM instance with the specified configuration
   */
  static create(config: VMConfig = {}): IVM {
    // Create or use provided dependencies
    const memory = config.memory || new Memory();
    const digest = config.digest || new Digest(memory);
    const symbolTable = config.symbolTable || new SymbolTable(digest);
    
    // Create VM instance with injected dependencies
    const vm = new VM(memory, digest, symbolTable);
    
    // Register operations if requested (default: true)
    if (config.registerOperations !== false) {
      registerBuiltins(vm, symbolTable);
    }
    
    // Create and connect compiler
    const compiler = new Compiler(vm);
    vm.initializeCompiler(compiler);
    
    return vm;
  }
}
```

### 3.3 Updated VM Implementation

Modify the VM class to accept dependencies via constructor:

```typescript
// src/core/vm.ts
import { IVM, IMemory, IDigest, ISymbolTable } from './interfaces';
import { Compiler } from '../lang/compiler';
import { STACK_SIZE, RSTACK_SIZE, SEG_STACK, SEG_RSTACK, SEG_CODE } from './memory';
import { fromTaggedValue, toTaggedValue, Tag } from './tagged';

/** Number of bytes per memory element (32-bit float) */
const BYTES_PER_ELEMENT = 4;

export class VM implements IVM {
  memory: IMemory;
  SP: number;
  RP: number;
  BP: number;
  IP: number;
  running: boolean;
  compiler!: Compiler;
  digest: IDigest;
  debug: boolean;
  symbolTable: ISymbolTable;
  listDepth: number;
  
  /**
   * Creates a new VM instance with injected dependencies
   */
  constructor(
    memory: IMemory,
    digest: IDigest,
    symbolTable: ISymbolTable
  ) {
    this.memory = memory;
    this.digest = digest;
    this.symbolTable = symbolTable;
    
    // Initialize pointers and state
    this.IP = 0;
    this.running = true;
    this.SP = 0;
    this.RP = 0;
    this.BP = 0;
    this.debug = false;
    this.listDepth = 0;
  }
  
  // Rest of VM implementation remains largely unchanged
  // ...
}
```

### 3.4 Global VM Provider

Replace the global VM instance with a provider that can be configured:

```typescript
// src/core/vm-provider.ts
import { IVM } from './interfaces';
import { VMFactory, VMConfig } from './vm-factory';

/**
 * Provides access to a shared VM instance
 * This replaces the global state pattern with a configurable provider
 */
export class VMProvider {
  private static instance: IVM | null = null;
  
  /**
   * Gets the shared VM instance, creating it if necessary
   */
  static getVM(): IVM {
    if (!VMProvider.instance) {
      VMProvider.instance = VMFactory.create();
    }
    return VMProvider.instance;
  }
  
  /**
   * Configures the shared VM instance with custom dependencies
   * Must be called before first use of getVM()
   */
  static configure(config: VMConfig): void {
    if (VMProvider.instance) {
      throw new Error('VM already initialized. Configure must be called before first use.');
    }
    VMProvider.instance = VMFactory.create(config);
  }
  
  /**
   * Resets the shared VM instance
   * Useful for testing or when needing a fresh VM state
   */
  static reset(): void {
    VMProvider.instance = null;
  }
}
```

### 3.5 Operation Implementation Updates

Operations should use the interface instead of the concrete VM class:

```typescript
// src/ops/builtins-interpreter.ts
import { IVM } from '../core/interfaces';
import { BYTES_PER_ELEMENT, RSTACK_SIZE } from '../core/memory';
import { toTaggedValue, fromTaggedValue, Tag, isCode } from '../core/tagged';

export const groupLeftOp = (vm: IVM) => {
  if (vm.RP + BYTES_PER_ELEMENT > RSTACK_SIZE) {
    throw new Error(`Return stack overflow: 'group-left' operation would exceed return stack capacity`);
  }
  vm.rpush(vm.SP);
};

// Other operations follow the same pattern
```

## 4. Implementation Plan

### 4.1 Phase 1: Create Interfaces and Factory

1. Define interfaces for all major components (Memory, Digest, SymbolTable, VM)
2. Create the VMFactory class for dependency injection
3. Update the VM class to accept dependencies via constructor
4. Create the VMProvider as a replacement for global state

### 4.2 Phase 2: Update VM Consumers

1. Update operation implementations to use IVM interface
2. Update tests to use VMFactory for creating test instances
3. Replace direct VM instantiation with VMFactory or VMProvider

### 4.3 Phase 3: Update Entry Points

1. Update `initializeInterpreter` in `globalState.ts` to use VMProvider
2. Ensure backward compatibility for existing code

## 5. Testing Strategy

### 5.1 Unit Testing with Mocks

```typescript
// Example test with mocked dependencies
import { IVM, IMemory } from '../core/interfaces';
import { VMFactory } from '../core/vm-factory';
import { addOp } from '../ops/builtins-math';

describe('addOp', () => {
  let mockMemory: IMemory;
  let vm: IVM;
  
  beforeEach(() => {
    // Create mock memory
    mockMemory = {
      read8: jest.fn(),
      read16: jest.fn(),
      readFloat32: jest.fn(),
      write8: jest.fn(),
      write16: jest.fn(),
      writeFloat32: jest.fn(),
      // ... other methods
    };
    
    // Create VM with mock memory
    vm = VMFactory.create({ memory: mockMemory });
    
    // Set up initial state
    vm.push(3);
    vm.push(4);
  });
  
  test('adds two numbers correctly', () => {
    // Execute operation
    addOp(vm);
    
    // Verify result
    expect(vm.pop()).toBe(7);
    expect(vm.SP).toBe(0);
  });
});
```

### 5.2 Integration Testing

```typescript
// Example integration test with real dependencies
import { VMFactory } from '../core/vm-factory';
import { IVM } from '../core/interfaces';

describe('VM integration', () => {
  let vm: IVM;
  
  beforeEach(() => {
    // Create real VM instance
    vm = VMFactory.create();
  });
  
  test('executes simple program', () => {
    // Set up program in memory
    // ...
    
    // Execute program
    // ...
    
    // Verify results
    // ...
  });
});
```

## 6. Migration Strategy

### 6.1 Create Parallel Implementation
- Build the new DI system alongside the existing code
- Keep both systems functional during transition

### 6.2 Update Tests First
- Convert tests to use the new system
- Ensure everything works with the new architecture
- Identify and fix any issues early

### 6.3 Gradual Migration
- Update components one by one to use the new interfaces
- Start with leaf components (operations) and work inward
- Update core components last

### 6.4 Compatibility Layer
- Maintain compatibility for components that haven't been updated yet
- Provide adapters between old and new systems
- Ensure backward compatibility for existing code

### 6.5 Remove Global State
- Once all components are updated, remove the old global state pattern
- Replace direct imports with VMProvider
- Clean up any remaining compatibility code

## 7. Benefits and Risks

### 7.1 Benefits

1. **Improved Testability**: Components can be tested in isolation with mocked dependencies
2. **Clearer Dependencies**: Dependencies are explicit in constructors rather than implicit
3. **Multiple VM Instances**: Support for multiple VM instances without global state conflicts
4. **Easier Maintenance**: Components are more loosely coupled and easier to modify
5. **Better Error Handling**: Clearer responsibility boundaries make error handling more robust

### 7.2 Risks and Mitigations

1. **Breaking Changes**: Mitigated by maintaining compatibility layers during transition
2. **Performance Impact**: Minimal; modern JS engines optimize interface-based code effectively
3. **Increased Complexity**: Mitigated by clear documentation and consistent patterns
4. **Migration Effort**: Phased approach reduces risk and allows incremental validation

## 8. Conclusion

This dependency injection plan provides a clear path to improving the modularity, testability, and maintainability of the Tacit VM while minimizing disruption to existing code. By introducing interfaces, a factory pattern, and a provider for global access, we can achieve the benefits of dependency injection without a complete rewrite of the codebase.

The implementation can be done incrementally, starting with the core interfaces and factory, then gradually updating consumers to use the new system. This approach balances the benefits of improved architecture with the practical constraints of maintaining a working system throughout the transition.
