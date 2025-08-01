# TACIT Unified Code Reference System Design

## Technical Analysis: Built-ins vs Colon Definitions

### Current Memory Layout
- **Total Memory**: 64KB (65536 bytes)
- **Code Segment**: Currently only 8KB allocated (8192 bytes), but ~62KB available
- **Code Addresses**: Currently 0-8191, could expand to 0-65535 with reallocation  
- **Tagged Values**: 22 bits total (6-bit tag + 16-bit value) 
- **Built-ins**: Direct JS function calls, no code segment presence
- **Colon definitions**: Bytecode in code segment, function table indirection

### The Fundamental Challenge

**Built-ins** and **colon definitions** are completely different beasts:

1. **Built-ins** (`@add`):
   - No code segment presence 
   - Direct JS function calls
   - Need opcode reference (0-127 currently)
   - Need immediate dispatch mechanism

2. **Colon definitions** (`@square`):
   - Bytecode stored in code segment
   - Need bytecode address (currently 0-8191, could be 0-65535)
   - Use call frame + IP jump mechanism

### Current Bytecode Address Encoding System

**The 15-bit limitation comes from the bytecode encoding scheme**:

```typescript
// Current encoding in compiler.compileOpcode():
if (opcodeAddress < 128) {
  // Built-ins: single byte [0-127]
  this.compile8(opcodeAddress);
} else {
  // User words: two bytes with high bit set
  this.compile8(0x80 | (opcodeAddress & 0x7f));  // Low 7 bits + high bit
  this.compile8((opcodeAddress >> 7) & 0xff);    // High 8 bits
}
// Result: 1 + 7 + 8 = 16 bits total, but high bit is flag → 15 bits for address
```

**Address space breakdown**:
- **Built-ins**: 0-127 (7 bits, single byte encoding)
- **User words**: 128-32767 (15 bits, two byte encoding)
- **Limitation**: High bit (0x80) used as "two-byte flag", leaving only 15 bits

### Current System: 15-bit Addressing is Perfect

**Address space breakdown**:
- **Built-ins**: 0-127 (7 bits, single byte encoding)
- **Colon definitions**: Direct bytecode addresses (0-32767, 15 bits)  
- **Current limit**: 32K colon definitions - more than sufficient
- **Encoding efficiency**: Compact two-byte format for user words

### Future Expansion Options (when needed)

#### Option A: Word-Aligned (16-bit addresses) 
- **Benefit**: 64K addresses (double capacity)
- **Cost**: Word alignment requirement  
- **When**: If 32K colon definitions becomes limiting

#### Option B: Three-Byte Encoding (22-bit addresses)
- **Benefit**: 4M addresses (massive capacity)  
- **Cost**: Larger bytecode, more complex encoding
- **When**: If massive code bases needed

**For now**: Current 15-bit system is ideal balance of simplicity and capacity.

### Solution Options for @symbol References

We have several encoding strategies to consider:

#### Option 1: Dual Tag Approach

Use different tags to distinguish built-ins from colon definitions:

```typescript
// Current tags
Tag.CODE = 2        // For colon definitions (bytecode addresses)
Tag.CODE_BLOCK = 3  // For standalone blocks

// NEW tags  
Tag.BUILTIN = 7     // For built-in operations (@add, @dup, etc.)
```

**Encoding**:
- `@add` → `toTaggedValue(5, Tag.BUILTIN)` // Opcode 5
- `@square` → `toTaggedValue(1024, Tag.CODE)` // Bytecode address

**Evaluation**:
```typescript
export const evalOp: Verb = (vm: VM) => {
  const value = vm.pop();
  const { tag, value: addr } = fromTaggedValue(value);
  
  if (tag === Tag.CODE || tag === Tag.CODE_BLOCK) {
    // Bytecode: set up call frame and jump
    vm.rpush(toTaggedValue(vm.IP, Tag.CODE));
    vm.rpush(vm.BP);
    vm.BP = vm.RP;
    vm.IP = addr;
  } else if (tag === Tag.BUILTIN) {
    // Built-in: direct JS function call
    const builtin = builtinTable[addr];
    builtin(vm);
  } else {
    vm.push(value); // Not executable
  }
};
```

#### Option 2: Address Space Partitioning

Use a single `Tag.CODE` with partitioned address space:

```typescript
// Address space (16-bit = 65536 total):
// 0-255:     Built-in opcodes (direct JS calls)
// 256-65535: Bytecode addresses (subtract 256 for actual offset)
```

**Pros**: Single evaluation path, unified tag
**Cons**: Artificial address translation, wastes low addresses

### Recommended Approach: Start with Current 15-bit System

The current 15-bit addressing (32K addresses) is **perfectly adequate** for the unified @symbol system:

#### Why 15-bit is Good Enough
- **32K colon definitions**: Far more than needed for most applications
- **Compact encoding**: Current two-byte system is very efficient  
- **No breaking changes**: Works with existing bytecode compilation
- **Clear upgrade path**: Can expand to 16-bit (64K) or even 22-bit later if needed

#### Future Expansion Options (when needed)
- **16-bit**: Word alignment → 64K addresses (128KB or 256KB code space)
- **22-bit**: Three-byte encoding → 4M addresses (massive code space)
- **But not now**: Current system is sufficient

### Implementation Strategy: Keep It Simple

#### Phase 1: Add Tag.BUILTIN with Current System
```typescript
export enum Tag {
  NUMBER = 0,
  INTEGER = 1, 
  CODE = 2,        // Colon definitions + standalone blocks (15-bit addresses)
  CODE_BLOCK = 3,  // Standalone blocks
  STRING = 4,
  LIST = 5,
  LINK = 6,
  BUILTIN = 7,     // NEW: Built-in operations (7-bit opcodes)
}
```

#### Phase 2: Enhanced evalOp (No encoding changes needed)
```typescript
export const evalOp: Verb = (vm: VM) => {
  vm.ensureStackSize(1, 'eval');
  const value = vm.pop();
  const { tag, value: addr } = fromTaggedValue(value);
  
  switch (tag) {
    case Tag.CODE:
    case Tag.CODE_BLOCK:
      // Bytecode: set up call frame and jump to address
      vm.rpush(toTaggedValue(vm.IP, Tag.CODE));
      vm.rpush(vm.BP);
      vm.BP = vm.RP;
      vm.IP = addr;  // Direct bytecode address (0-32767)
      break;
      
    case Tag.BUILTIN:
      // Built-in: direct JS function dispatch
      executeOp(vm, addr);  // Opcode (0-127)
      break;
      
    default:
      vm.push(value); // Not executable
      break;
  }
};
```

#### Phase 3: @symbol Implementation  
```typescript
export const atPrefixOp: Verb = (vm: VM) => {
  const symbolName = vm.readString();
  const symbolData = vm.symbolTable.findCodeRef(symbolName);
  
  if (!symbolData) {
    throw new Error(`Unknown symbol: ${symbolName}`);
  }
  
  if (symbolData.isBuiltin) {
    // Built-in: push opcode with BUILTIN tag
    vm.push(toTaggedValue(symbolData.opcode, Tag.BUILTIN));
  } else {
    // Colon definition: push bytecode address with CODE tag
    vm.push(toTaggedValue(symbolData.bytecodeAddr, Tag.CODE));
  }
};
```

### Recommended Solution: Option 1 + Memory Expansion

**Best approach combines new tag types with expanded memory**:

#### Phase 1: Add Tag.BUILTIN

```typescript
export enum Tag {
  NUMBER = 0,
  INTEGER = 1, 
  CODE = 2,        // Colon definitions + standalone blocks
  CODE_BLOCK = 3,  // Currently used for something?
  STRING = 4,
  LIST = 5,
  LINK = 6,
  BUILTIN = 7,     // NEW: Built-in operations
}
```

#### Phase 2: Expand Code Segment (Optional)

```typescript
// Current: 8KB byte-addressed
export const CODE_SIZE = 0x2000;  // 8192 bytes

// Proposed: 64KB byte-addressed OR 256KB 32-bit aligned  
export const CODE_SIZE = 0x10000; // 64KB = 65536 addresses
// OR
export const CODE_SIZE = 0x40000; // 256KB = 65536 × 4-byte words
```

#### Phase 3: Enhanced evalOp

```typescript
export const evalOp: Verb = (vm: VM) => {
  vm.ensureStackSize(1, 'eval');
  const value = vm.pop();
  const { tag, value: addr } = fromTaggedValue(value);
  
  switch (tag) {
    case Tag.CODE:
    case Tag.CODE_BLOCK:
      // Bytecode execution (colon definitions, standalone blocks)
      vm.rpush(toTaggedValue(vm.IP, Tag.CODE));
      vm.rpush(vm.BP);
      vm.BP = vm.RP;
      vm.IP = addr;
      break;
      
    case Tag.BUILTIN:
      // Direct built-in execution  
      executeOp(vm, addr); // Reuse existing builtin dispatch
      break;
      
    default:
      // Not executable - push back
      vm.push(value);
      break;
  }
};
```

#### Phase 4: @ Prefix Implementation

```typescript
export const atPrefixOp: Verb = (vm: VM) => {
  const symbolName = vm.readString();
  const symbolIndex = vm.symbolTable.find(symbolName);
  
  if (symbolIndex === undefined) {
    throw new Error(`Unknown symbol: ${symbolName}`);
  }
  
  if (symbolIndex < 128) {
    // Built-in operation
    vm.push(toTaggedValue(symbolIndex, Tag.BUILTIN));
  } else {
    // Colon definition - need to get actual bytecode address
    const implementation = vm.symbolTable.findImplementationByOpcode(symbolIndex);
    if (implementation) {
      // This is where we need the direct bytecode address!
      // Currently hidden behind function table indirection
      const bytecodeAddr = getBytecodeAddress(symbolIndex);
      vm.push(toTaggedValue(bytecodeAddr, Tag.CODE));
    }
  }
};
```

### Key Insight: Function Table Elimination

The **real problem** is that colon definitions currently go through the function table:

```
Current: @square → symbolTable.find("square") → 128 → functionTable[128] → bytecode_addr
Desired: @square → symbolTable.find("square") → bytecode_addr (direct)
```

**Solution**: Store bytecode addresses directly in symbol table:

```typescript
class SymbolTable {
  // Current: maps name → function index
  define(name: string, functionIndex: number, implementation?: WordFunction): void;
  
  // NEW: maps name → direct code reference  
  defineCode(name: string, bytecodeAddr: number): void;
  defineBuiltin(name: string, opcode: number): void;
  
  findCodeRef(name: string): { tag: Tag, addr: number } | undefined;
}
```

### Usage Examples

```tacit
# All work with unified eval!
{ 1 2 add } eval        # Tag.CODE(bytecode) → call frame + jump
@square eval            # Tag.CODE(bytecode) → call frame + jump  
@add eval               # Tag.BUILTIN(5) → direct JS function call

# Store and manipulate code references
@add 'addition def      # Store built-in reference
@square 'sq def         # Store colon definition reference
2 3 addition eval       # → 5
3 sq eval               # → 9
```

### Memory Analysis

#### Current Waste:
- Function table: 32K × 8 bytes = 256KB (mostly empty)
- Indirection: symbol → function index → bytecode address

#### Proposed Efficiency:
- Symbol table: Only defined symbols (sparse)  
- Direct addressing: symbol → bytecode address or opcode
- Memory savings: ~250KB

### Implementation Complexity

**Easy path** (no memory expansion):
1. Add `Tag.BUILTIN` 
2. Modify `evalOp` to handle both tags
3. Store direct addresses in symbol table
4. Remove function table

**Advanced path** (with expansion):
1. Expand code segment to 64KB-256KB
2. 32-bit alignment for better addressing
3. More colon definitions possible

### Usage Examples

**The magic is that this already works for standalone blocks!**

```tacit
# Current: standalone blocks work perfectly
{ 1 2 add } eval     # pushes 3
{ dup mul } eval     # squares TOS

# Proposed: @ symbols use the same mechanism  
: square dup mul ;
2 @square eval       # pushes 4 (same as above!)

# Built-ins work too
2 3 @add eval        # pushes 5

# Unified behavior - both create Tag.CODE values
{ 5 6 mul }          # → Tag.CODE(bytecode_addr)  
@square              # → Tag.CODE(unified_addr)
@add                 # → Tag.CODE(builtin_addr)

# All work with same eval!
{ 2 3 add } eval     # → 5
@add 2 3 swap eval   # → 5 (when we implement @)
```

**Key insight**: `{ }` blocks and `@symbol` both produce `Tag.CODE` values that `eval` handles identically!

### Bytecode Encoding

#### Current (wasteful):
```
Call built-in:     [opcode]           (1 byte)
Call user word:    [0x80|low] [high]  (2 bytes) -> lookup in function table
```

#### Proposed (efficient):
```
Call built-in:     [opcode]           (1 byte)  -> direct execution
Call user word:    [0x80|low] [high]  (2 bytes) -> direct bytecode jump  
@ prefix:          [@] [symbol_id]    (2+ bytes) -> push code reference
```

### Memory Savings

- **Function Table**: Eliminate 32K × 4-8 bytes = 128KB-256KB
- **Sparse Allocation**: Only allocate space for defined symbols
- **Direct Addressing**: No indirection through function table

### Detailed Implementation Plan: VM-First Approach

**Phase 1: Core VM Infrastructure (No Language Changes)**

1. **✅ COMPLETE: Add Tag.BUILTIN to tagged value system**
   - ✅ Add `BUILTIN = 7` to `Tag` enum in `tagged.ts`
   - ✅ Update `tagNames` mapping for debugging
   - ✅ Add validation in `toTaggedValue()` for new tag
   - ✅ Update affected tests (tagged.test.ts, printer.test.ts)
   - ✅ Create comprehensive test suite for Tag.BUILTIN functionality
   - ✅ **IMPROVEMENT**: Add `MAX_TAG` constant to avoid hardcoded enum values in tests

2. **✅ COMPLETE: Enhance evalOp to handle Tag.BUILTIN dispatch**
   - ✅ Modify `evalOp` in `builtins-interpreter.ts` 
   - ✅ Add `case Tag.BUILTIN:` branch that calls `executeOp(vm, addr)`
   - ✅ Keep existing `Tag.CODE` behavior unchanged
   - ✅ Test with manually created `Tag.BUILTIN` values
   - ✅ Consolidated tests into proper location (`interpreter-operations.test.ts`)

3. **✅ COMPLETE: Create VM-level code reference utilities**
   - ✅ Add `createBuiltinRef(opcode: number)` helper function
   - ✅ Add `createCodeRef(bytecodeAddr: number)` helper function  
   - ✅ Add `isBuiltinRef(value: number)` and `isCodeRef(value: number)` utilities
   - ✅ Add `isExecutableRef()`, `getBuiltinOpcode()`, `getCodeAddress()` utilities
   - ✅ Test these utilities work with enhanced `evalOp`
   - ✅ Added comprehensive test coverage in `src/test/core/code-ref.test.ts`

4. **✅ COMPLETE: Test VM-level unified dispatch**
   - ✅ Write unit tests that manually push `Tag.BUILTIN` values and call `evalOp`
   - ✅ Write unit tests that manually push `Tag.CODE` values and call `evalOp`
   - ✅ Verify both dispatch correctly without any language changes
   - ✅ Test edge cases (invalid opcodes, invalid addresses)
   - ✅ Added comprehensive test coverage in `src/test/core/vm-unified-dispatch.test.ts`

**Phase 2: Symbol Table Enhancement (Still No Language Changes)**

5. **✅ COMPLETE: Extend SymbolTable with direct addressing**
   - ✅ Add `defineBuiltin(name: string, opcode: number)` method
   - ✅ Add `defineCode(name: string, bytecodeAddr: number)` method
   - ✅ Add `findCodeRef(name: string): { tag: Tag, addr: number } | undefined` method
   - ✅ Add `CodeReference` interface with tag and addr fields
   - ✅ Extended `SymbolTableNode` with optional `codeRef` field
   - ✅ Keep existing API intact for backward compatibility
   - ✅ Added comprehensive test coverage in `src/test/strings/symbol-table-direct-addressing.test.ts`

6. **✅ COMPLETE: Add VM-level symbol resolution**
   - ✅ Add `vm.resolveSymbol(name: string)` method that returns tagged value
   - ✅ Use `symbolTable.findCodeRef()` internally
   - ✅ Return `Tag.BUILTIN` for built-ins, `Tag.CODE` for colon definitions
   - ✅ Added comprehensive test coverage in `src/test/core/vm-symbol-resolution.test.ts`
   - ✅ Test with manually registered symbols (no parsing yet)

7. **⏸️ NEXT: Test symbol table integration**
   - Manually register built-in symbols: `symbolTable.defineBuiltin("add", Op.Add)`
   - Manually register code symbols: `symbolTable.defineCode("test", 1000)`
   - Test `vm.resolveSymbol()` returns correct tagged values
   - Test resolved values work with `evalOp`
   - **⚠️ STOP HERE - CHECK WITH USER BEFORE PROCEEDING**

**Phase 3: Function Table Elimination Preparation**

8. **Create function table bypass mechanism**
   - Add `getFunctionTableBypass(functionIndex: number): number | undefined`
   - Maps function indices directly to bytecode addresses
   - Use existing function table as source of truth initially
   - Test that bypass returns correct addresses
   - **⚠️ STOP HERE - CHECK WITH USER BEFORE PROCEEDING**

9. **Update colon definition storage**
   - When defining colon definitions, also store in symbol table with `defineCode()`
   - Store actual bytecode address, not function index
   - Keep function table working in parallel for now
   - Test both paths return same results
   - **⚠️ STOP HERE - CHECK WITH USER BEFORE PROCEEDING**

**Phase 4: VM Executor Integration**

10. **Modify executeOp for unified dispatch**
    - Update `executeOp` to handle opcodes >= 128 via symbol table lookup
    - If function table lookup fails, try symbol table direct addressing
    - Keep function table as fallback initially
    - Test existing bytecode still works
    - **⚠️ STOP HERE - CHECK WITH USER BEFORE PROCEEDING**

11. **Add VM-level @ symbol resolution**
    - Add `vm.pushSymbolRef(name: string)` method
    - Calls `vm.resolveSymbol()` and pushes result to stack
    - Test manually: `vm.pushSymbolRef("add"); evalOp(vm);`
    - Verify works for both built-ins and colon definitions
    - **⚠️ STOP HERE - CHECK WITH USER BEFORE PROCEEDING**

12. **Comprehensive VM testing**
    - Test all VM-level functionality without language changes
    - Test mixed scenarios: built-ins, colon definitions, standalone blocks
    - Performance test to ensure no regressions
    - Memory test to verify function table can be eliminated
    - **⚠️ STOP HERE - CHECK WITH USER BEFORE PROCEEDING**

**Phase 5: Language Integration (Only After VM Works)**

13. **Add @ prefix to tokenizer**
    - Add `@` as special character in tokenizer
    - Add `@symbol` token type
    - Test tokenization in isolation
    - **⚠️ STOP HERE - CHECK WITH USER BEFORE PROCEEDING**

14. **Add @ prefix to parser/compiler**
    - Add `processAtSymbol()` function to parser
    - Call `vm.pushSymbolRef()` from compiler
    - Test with simple cases first
    - **⚠️ STOP HERE - CHECK WITH USER BEFORE PROCEEDING**

15. **Remove function table dependency**
    - Switch executeOp to use symbol table exclusively
    - Remove FunctionTable class
    - Update all references
    - Comprehensive testing
    - **⚠️ STOP HERE - CHECK WITH USER BEFORE PROCEEDING**

16. **Update all tests and examples**
    - Update existing tests for new behavior
    - Add comprehensive @ symbol tests
    - Update documentation and examples
    - **⚠️ STOP HERE - CHECK WITH USER BEFORE PROCEEDING**

17. **Low Priority Cleanup: Eliminate Tag.CODE_BLOCK** (standalone blocks already use Tag.CODE)
    - **⚠️ STOP HERE - CHECK WITH USER BEFORE PROCEEDING**

**🚨 CRITICAL RULE: STOP AFTER EVERY STEP AND CHECK WITH USER BEFORE PROCEEDING 🚨**

**Key Principle: Each step must be tested and working before proceeding to the next step.**

**🚨 MANDATORY PROTOCOL: STOP AFTER EVERY STEP AND GET USER APPROVAL 🚨**

### Backward Compatibility

- Existing bytecode format remains valid
- Built-in opcodes (0-127) work unchanged
- User word calls transition from function table lookup to direct addressing
- Symbol table API expands but doesn't break existing usage

### Benefits

1. **Memory Efficient**: Eliminates 32K function table waste
2. **Unified Dispatch**: Same mechanism for built-ins and user words
3. **Metaprogramming**: `@symbol` enables powerful reflection
4. **Performance**: Direct addressing eliminates function table indirection
5. **Scalability**: 16-bit space supports 65K symbols vs current 32K limit

### Summary: Pragmatic Implementation Plan

**Phase 1: Implement @symbol with current 15-bit system**
1. Add `Tag.BUILTIN` for built-ins (opcodes 0-127)
2. Use `Tag.CODE` for colon definitions (bytecode addresses) 
3. Enhanced `evalOp` dispatches based on tag type
4. **Eliminate function table** - store direct addresses in symbol table
5. **Keep current encoding** - no bytecode format changes

**Benefits achieved immediately**:
- ✅ Unified `@symbol eval` for built-ins and colon definitions
- ✅ Eliminate 256KB function table waste  
- ✅ Same `eval` works for `{ }` blocks and `@symbol`
- ✅ No breaking changes to existing system
- ✅ 32K colon definition capacity (plenty for now)

**Future expansion** (when/if needed):
- 16-bit addressing via word alignment → 64K definitions
- 22-bit addressing via three-byte encoding → 4M definitions  
- But current 15-bit system is perfectly adequate

This approach gives you the metaprogramming power you want (`2 @square eval`) while maintaining the elegant simplicity and efficiency of the current bytecode system.
