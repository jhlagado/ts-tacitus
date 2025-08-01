# Plan 01: TACIT Unified Code Reference System

## Plan Overview
Implementation of the @symbol reference system that enables metaprogramming by creating references to both built-in operations and colon definitions, unified under a single `eval` mechanism.

## Status: 🟡 **IN PROGRESS** (Steps 1-7 Complete, Step 8 Active)

---

## Step 01: ✅ **COMPLETE** - Add Tag.BUILTIN to tagged value system
- ✅ Add `BUILTIN = 7` to `Tag` enum in `tagged.ts`
- ✅ Update `tagNames` mapping for debugging
- ✅ Add validation in `toTaggedValue()` for new tag
- ✅ Update affected tests (tagged.test.ts, printer.test.ts)
- ✅ Create comprehensive test suite for Tag.BUILTIN functionality
- ✅ **IMPROVEMENT**: Add `MAX_TAG` constant to avoid hardcoded enum values in tests

## Step 02: ✅ **COMPLETE** - Enhance evalOp to handle Tag.BUILTIN dispatch
- ✅ Modify `evalOp` in `builtins-interpreter.ts` 
- ✅ Add `case Tag.BUILTIN:` branch that calls `executeOp(vm, addr)`
- ✅ Keep existing `Tag.CODE` behavior unchanged
- ✅ Test with manually created `Tag.BUILTIN` values
- ✅ Consolidated tests into proper location (`interpreter-operations.test.ts`)

## Step 03: ✅ **COMPLETE** - Create VM-level code reference utilities
- ✅ Add `createBuiltinRef(opcode: number)` helper function
- ✅ Add `createCodeRef(bytecodeAddr: number)` helper function  
- ✅ Add `isBuiltinRef(value: number)` and `isCodeRef(value: number)` utilities
- ✅ Add `isExecutableRef()`, `getBuiltinOpcode()`, `getCodeAddress()` utilities
- ✅ Test these utilities work with enhanced `evalOp`
- ✅ Added comprehensive test coverage in `src/test/core/code-ref.test.ts`

## Step 04: ✅ **COMPLETE** - Test VM-level unified dispatch
- ✅ Write unit tests that manually push `Tag.BUILTIN` values and call `evalOp`
- ✅ Write unit tests that manually push `Tag.CODE` values and call `evalOp`
- ✅ Verify both dispatch correctly without any language changes
- ✅ Test edge cases (invalid opcodes, invalid addresses)
- ✅ Added comprehensive test coverage in `src/test/core/vm-unified-dispatch.test.ts`

## Step 05: ✅ **COMPLETE** - Extend SymbolTable with direct addressing
- ✅ Add `defineBuiltin(name: string, opcode: number)` method
- ✅ Add `defineCode(name: string, bytecodeAddr: number)` method
- ✅ Add `findCodeRef(name: string): { tag: Tag, addr: number } | undefined` method
- ✅ Add `CodeReference` interface with tag and addr fields
- ✅ Extended `SymbolTableNode` with optional `codeRef` field
- ✅ Keep existing API intact for backward compatibility
- ✅ Added comprehensive test coverage in `src/test/strings/symbol-table-direct-addressing.test.ts`

## Step 06: ✅ **COMPLETE** - Add VM-level symbol resolution
- ✅ Add `vm.resolveSymbol(name: string)` method that returns tagged value
- ✅ Use `symbolTable.findCodeRef()` internally
- ✅ Return `Tag.BUILTIN` for built-ins, `Tag.CODE` for colon definitions
- ✅ Added comprehensive test coverage in `src/test/core/vm-symbol-resolution.test.ts`
- ✅ Test with manually registered symbols (no parsing yet)

## Step 07: ✅ **COMPLETE** - Test symbol table integration
- ✅ Manually register built-in symbols: `symbolTable.defineBuiltin("add", Op.Add)`
- ✅ Manually register code symbols: `symbolTable.defineCode("test", 1000)`
- ✅ Test `vm.resolveSymbol()` returns correct tagged values
- ✅ Test resolved values work with `evalOp`
- ✅ Added comprehensive integration test coverage in `src/test/integration/symbol-table-integration.test.ts`
- ✅ **VERIFIED**: Complete workflow simulation proves @symbol eval will work correctly

---

## Step 08: 🎯 **ACTIVE** - Create function table bypass mechanism
- Add `getFunctionTableBypass(functionIndex: number): number | undefined`
- Maps function indices directly to bytecode addresses
- Use existing function table as source of truth initially
- Test that bypass returns correct addresses
- **⚠️ STOP HERE - CHECK WITH USER BEFORE PROCEEDING**

## Step 09: ⏸️ **PENDING** - Update colon definition storage
- When defining colon definitions, also store in symbol table with `defineCode()`
- Store actual bytecode address, not function index
- Keep function table working in parallel for now
- Test both paths return same results
- **⚠️ STOP HERE - CHECK WITH USER BEFORE PROCEEDING**

## Step 10: ⏸️ **PENDING** - Modify executeOp for unified dispatch
- Update `executeOp` to handle opcodes >= 128 via symbol table lookup
- If function table lookup fails, try symbol table direct addressing
- Keep function table as fallback initially
- Test existing bytecode still works
- **⚠️ STOP HERE - CHECK WITH USER BEFORE PROCEEDING**

## Step 11: ⏸️ **PENDING** - Add VM-level @ symbol resolution
- Add `vm.pushSymbolRef(name: string)` method
- Calls `vm.resolveSymbol()` and pushes result to stack
- Test manually: `vm.pushSymbolRef("add"); evalOp(vm);`
- Verify works for both built-ins and colon definitions
- **⚠️ STOP HERE - CHECK WITH USER BEFORE PROCEEDING**

## Step 12: ⏸️ **PENDING** - Comprehensive VM testing
- Test all VM-level functionality without language changes
- Test mixed scenarios: built-ins, colon definitions, standalone blocks
- Performance test to ensure no regressions
- Memory test to verify function table can be eliminated
- **⚠️ STOP HERE - CHECK WITH USER BEFORE PROCEEDING**

## Step 13: ⏸️ **PENDING** - Add @ prefix to tokenizer
- Add `@` as special character in tokenizer
- Add `@symbol` token type
- Test tokenization in isolation
- **⚠️ STOP HERE - CHECK WITH USER BEFORE PROCEEDING**

## Step 14: ⏸️ **PENDING** - Add @ prefix to parser/compiler
- Add `processAtSymbol()` function to parser
- Call `vm.pushSymbolRef()` from compiler
- Test with simple cases first
- **⚠️ STOP HERE - CHECK WITH USER BEFORE PROCEEDING**

## Step 15: ⏸️ **PENDING** - Remove function table dependency
- Switch executeOp to use symbol table exclusively
- Remove FunctionTable class
- Update all references
- Comprehensive testing
- **⚠️ STOP HERE - CHECK WITH USER BEFORE PROCEEDING**

## Step 16: ⏸️ **PENDING** - Update all tests and examples
- Update existing tests for new behavior
- Add comprehensive @ symbol tests
- Update documentation and examples
- **⚠️ STOP HERE - CHECK WITH USER BEFORE PROCEEDING**

## Step 17: ⏸️ **PENDING** - Low Priority Cleanup: Eliminate Tag.CODE_BLOCK
- Standalone blocks already use Tag.CODE
- **⚠️ STOP HERE - CHECK WITH USER BEFORE PROCEEDING**

---

## 🚨 **MANDATORY PROTOCOL**
**STOP AFTER EVERY STEP AND GET USER APPROVAL BEFORE PROCEEDING**

## Dependencies
- `specs/vm-architecture.md` - Memory layout and execution model
- `specs/tagged-values.md` - Type system and NaN-boxing
- `specs/lists.md` - Data structure specifications
- `reference/glossary.md` - TACIT terminology

## Success Criteria
- [ ] Unified `@symbol eval` for built-ins and colon definitions
- [ ] Eliminate 256KB function table waste  
- [ ] Same `eval` works for `{ }` blocks and `@symbol`
- [ ] No breaking changes to existing system
- [ ] 32K colon definition capacity maintained

## Technical Architecture

### Current Memory Layout
- **Total Memory**: 64KB (65536 bytes)
- **Code Segment**: 8KB allocated, ~62KB available
- **Tagged Values**: 22 bits total (6-bit tag + 16-bit value)
- **Address Space**: 15-bit addressing (32K colon definitions)

### Key Insight: Function Table Elimination
```
Current: @square → symbolTable.find("square") → 128 → functionTable[128] → bytecode_addr
Desired: @square → symbolTable.find("square") → bytecode_addr (direct)
```

### Unified Dispatch Mechanism
```typescript
// Built-ins: @add → Tag.BUILTIN(Op.Add) → executeOp(vm, Op.Add)
// Colon defs: @square → Tag.CODE(addr_1024) → call frame + jump to 1024
// Both work with: @symbol eval
```

## Expected Usage
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

## Files Modified/Created
- `src/core/tagged.ts` - Added Tag.BUILTIN
- `src/ops/builtins-interpreter.ts` - Enhanced evalOp
- `src/core/code-ref.ts` - Code reference utilities
- `src/strings/symbol-table.ts` - Direct addressing methods
- `src/core/vm.ts` - Symbol resolution method
- `src/test/integration/symbol-table-integration.test.ts` - Integration tests
- Multiple test files for comprehensive coverage

## Current Status Details
**Phase 1-2 Complete**: VM infrastructure and symbol table enhancements working
**Step 8 Active**: Ready to implement function table bypass mechanism
**Next**: Continue with systematic function table elimination
