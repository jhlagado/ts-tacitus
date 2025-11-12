# Tag.CODE Extension Plan: Treat Values < 128 as Builtins

## Goal

Extend `Tag.CODE` so that if its **decoded** value is < 128, it behaves like `Tag.BUILTIN` (dispatches to built-in operations instead of jumping to bytecode).

## Current Tag.BUILTIN Usage

### 1. **evalOp Dispatch** (`src/ops/core/core-ops.ts:260-262`)

```260:262:src/ops/core/core-ops.ts
    case Tag.BUILTIN:
      executeOp(vm, addr);
      break;
```

**Behavior:** Pops a `Tag.BUILTIN` value, extracts the opcode (0-127), and calls `executeOp(vm, addr)` which looks up the implementation function in `OPCODE_TO_VERB` table.

### 2. **Parser Compilation** (`src/lang/parser.ts:237-239`)

```237:239:src/lang/parser.ts
  if (tag === Tag.BUILTIN) {
    vm.compiler.compileOpcode(tagValue);
    return;
  }
```

**Behavior:** When a symbol resolves to `Tag.BUILTIN`, emits a single-byte opcode (bit 7 = 0) in the bytecode.

### 3. **Immediate Word Execution** (`src/lang/meta/executor.ts:46`)

```46:46:src/lang/meta/executor.ts
  if (tag === Tag.BUILTIN) {
```

**Behavior:** Checks if an immediate word is a builtin and dispatches by name (e.g., `:`, `if`, `;`).

### 4. **executeOp Function** (`src/ops/builtins.ts:161-169`)

```161:169:src/ops/builtins.ts
export function executeOp(vm: VM, opcode: Op, isUserDefined = false): void {
  if (isUserDefined) {
    rpush(vm, vm.IP);
    // Save BP as relative cells
    rpush(vm, vm.bp - RSTACK_BASE);
    vm.bp = vm.rsp;
    vm.IP = opcode;
    return;
  }

  const OPCODE_TO_VERB: Partial<Record<Op, Verb>> = {
```

**Behavior:** Looks up opcode in `OPCODE_TO_VERB` table and calls the implementation function. If `isUserDefined = true`, treats it as a bytecode address instead.

---

## Current Tag.CODE Usage

### 1. **evalOp Dispatch** (`src/ops/core/core-ops.ts:246-258`)

```246:258:src/ops/core/core-ops.ts
    case Tag.CODE:
      const decodedAddr = decodeX1516(addr); // Decode X1516 to get actual address
      if (meta === 1) {
        rpush(vm, vm.IP);
        vm.IP = decodedAddr;
      } else {
        rpush(vm, vm.IP);
        // Save BP as relative cells on the return stack for compatibility
        rpush(vm, vm.bp - RSTACK_BASE);
        vm.bp = vm.rsp;
        vm.IP = decodedAddr;
      }
      break;
```

**Behavior:** Always decodes X1516 address and jumps to bytecode. **No check for < 128.**

### 2. **Parser Compilation** (`src/lang/parser.ts:230-234`)

```230:234:src/lang/parser.ts
  if (tag === Tag.CODE) {
    // Decode X1516 encoded address to get actual bytecode address
    const decodedAddress = decodeX1516(tagValue);
    vm.compiler.compileUserWordCall(decodedAddress);
    return;
  }
```

**Behavior:** Always decodes X1516 and emits two-byte user word call (bit 7 = 1). **No check for < 128.**

### 3. **Immediate Word Execution** (`src/lang/meta/executor.ts` - not shown, but similar pattern)

**Behavior:** Decodes X1516 and calls `runImmediateCode` with the decoded address.

---

## Proposed Changes

### Change 1: Update `evalOp` to Check Encoded Value

**File:** `src/ops/core/core-ops.ts`

```typescript
case Tag.CODE:
  // If encoded value < 128, it's invalid X1516 format, so treat as builtin opcode
  if (addr < 128) {
    // Use encoded value directly as opcode (0-127)
    executeOp(vm, addr);
    break;
  }

  // Otherwise, decode X1516 and jump to bytecode (existing behavior)
  const decodedAddr = decodeX1516(addr);
  if (meta === 1) {
    rpush(vm, vm.IP);
    vm.IP = decodedAddr;
  } else {
    rpush(vm, vm.IP);
    rpush(vm, vm.bp - RSTACK_BASE);
    vm.bp = vm.rsp;
    vm.IP = decodedAddr;
  }
  break;
```

**Impact:**

- ✅ `Tag.CODE` values with encoded value < 128 will dispatch to builtins (no decode needed!)
- ✅ `Tag.CODE` values with encoded value ≥ 128 will decode X1516 and jump to bytecode (existing behavior)
- ✅ `Tag.BUILTIN` behavior unchanged
- ✅ **Performance benefit:** Builtins don't need X1516 decoding

### Change 2: Update Parser to Check Encoded Value

**File:** `src/lang/parser.ts`

```typescript
if (tag === Tag.CODE) {
  // If encoded value < 128, it's invalid X1516 format, so treat as builtin opcode
  if (tagValue < 128) {
    // Use encoded value directly as opcode (0-127), emit single byte
    vm.compiler.compileOpcode(tagValue);
    return;
  }

  // Otherwise, decode X1516 and compile as user word call (two bytes)
  const decodedAddress = decodeX1516(tagValue);
  vm.compiler.compileUserWordCall(decodedAddress);
  return;
}
```

**Impact:**

- ✅ Symbols resolving to `Tag.CODE` with encoded value < 128 will emit single-byte opcodes (no decode needed!)
- ✅ Symbols resolving to `Tag.CODE` with encoded value ≥ 128 will decode X1516 and emit two-byte user word calls
- ✅ `Tag.BUILTIN` behavior unchanged
- ✅ **Performance benefit:** Builtins don't need X1516 decoding

### Change 3: Update Immediate Word Execution

**File:** `src/lang/meta/executor.ts`

```typescript
if (tag === Tag.CODE) {
  // If encoded value < 128, it's invalid X1516 format, so treat as builtin immediate word
  if (value < 128) {
    // Dispatch by name (same as Tag.BUILTIN case)
    switch (name) {
      case ':':
        beginDefinitionImmediate(vm, tokenizer, currentDefinition);
        return;
      // ... other immediate words ...
    }
  }

  // Otherwise, decode X1516 and run as immediate code block
  const decodedAddress = decodeX1516(value);
  runImmediateCode(vm, decodedAddress);
  return;
}
```

**Impact:**

- ✅ Immediate words with `Tag.CODE` encoded value < 128 will dispatch by name (no decode needed!)
- ✅ Immediate words with `Tag.CODE` encoded value ≥ 128 will decode X1516 and run as code blocks
- ⚠️ **Question:** Do we want immediate words to be stored as `Tag.CODE` with < 128? Currently they're `Tag.BUILTIN` with meta=1.

---

## Encoding Considerations

### X1516 Format Constraint

**X1516 format requires bit 7 to be set:**

- Valid X1516 encoded values: `0x0080-0xFFFF` (128-65535)
- Invalid X1516 values: `0x0000-0x007F` (0-127) - bit 7 is NOT set

**Key Insight:** Values 0-127 in `Tag.CODE` are **invalid X1516 format**, so we can use this space to store builtin opcodes directly!

### Encoding Space Usage

**Tag.CODE value ranges:**

- `0-127`: Invalid X1516, treat as builtin opcode (direct, no encoding)
- `128-65535`: Valid X1516, decode to get bytecode address (0-32767)

**Tag.BUILTIN value ranges:**

- `0-127`: Builtin opcode (direct, no encoding)

### Backward Compatibility

**Current State:**

- `Tag.BUILTIN`: Stores opcode directly (0-127)
- `Tag.CODE`: Stores X1516 encoded address (0-32767 → 0x0080-0xFFFF)

**After Extension:**

- `Tag.BUILTIN`: Unchanged (still stores opcode directly 0-127)
- `Tag.CODE`:
  - If encoded value < 128: Treated as builtin opcode directly (new behavior, no decode!)
  - If encoded value ≥ 128: Decode X1516 and treat as bytecode address (existing behavior)

**Compatibility:**

- ✅ Existing `Tag.BUILTIN` values continue to work
- ✅ Existing `Tag.CODE` values ≥ 128 (valid X1516) continue to work
- ✅ New `Tag.CODE` values < 128 will dispatch to builtins (new feature, no decode needed!)

---

## Implementation Steps

1. **Update `evalOp`** to check encoded value < 128 (before decode)
2. **Update `parser.ts` `emitWord`** to check encoded value < 128 (before decode)
3. **Update `executor.ts` `executeImmediateWord`** to check encoded value < 128 (before decode, if needed)
4. **Update `createCodeRef()`** - Should it allow values < 128? Currently rejects them.
5. **Add tests** for `Tag.CODE` with encoded values < 128 dispatching to builtins
6. **Update documentation** to reflect the new behavior

---

## Test Cases

### Test 1: Tag.CODE with encoded value < 128 in evalOp

```typescript
test('Tag.CODE with encoded value < 128 dispatches to builtin', () => {
  // Create Tag.CODE with encoded value = Op.Add (direct, no X1516 encoding)
  const codeRef = toTaggedValue(Op.Add, Tag.CODE); // Op.Add < 128
  push(vm, 2);
  push(vm, 3);
  push(vm, codeRef);

  evalOp(vm);

  // Should execute Add operation (no decode needed!)
  expect(getStackData(vm)).toEqual([5]);
});
```

### Test 2: Tag.CODE with encoded value ≥ 128 in evalOp

```typescript
test('Tag.CODE with encoded value ≥ 128 decodes X1516 and jumps to bytecode', () => {
  // Create Tag.CODE with X1516 encoded address (e.g., address 128 → encoded 0x0180)
  const codeRef = createCodeRef(128); // Encodes to 0x0180 (≥ 128)
  // ... set up bytecode at address 128 ...
  push(vm, codeRef);

  evalOp(vm);

  // Should decode X1516 and jump to bytecode address 128
  expect(vm.IP).toBe(128);
});
```

### Test 3: Parser emits single-byte opcode for Tag.CODE < 128

```typescript
test('Parser compiles Tag.CODE < 128 as single-byte opcode', () => {
  // Define symbol with Tag.CODE encoded value < 128 (direct opcode, no X1516)
  define(vm, 'myadd', toTaggedValue(Op.Add, Tag.CODE)); // Op.Add < 128

  // Parse and compile
  parseAndCompile(vm, 'myadd');

  // Should emit single byte (opcode), not two-byte user word call
  const bytecode = getBytecode(vm);
  expect(bytecode[0]).toBe(Op.Add);
  expect(bytecode.length).toBe(1); // Not 2
});
```

---

## Open Questions

1. **Should `createCodeRef()` allow values < 128?**
   - Currently: `createCodeRef()` accepts 0-32767, encodes with X1516
   - If we pass < 128 to `createCodeRef()`, it will encode to 0x0080-0x00FF (valid X1516)
   - **Problem:** We want < 128 to be stored **directly** (not encoded) in `Tag.CODE`
   - **Solution:** `createCodeRef()` should check if address < 128, and if so, store directly without encoding
   - **Alternative:** Use `toTaggedValue(opcode, Tag.CODE)` directly for builtins < 128

2. **Should immediate words use `Tag.CODE` with < 128?**
   - Currently: Immediate words are `Tag.BUILTIN` with meta=1
   - After extension: Could use `Tag.CODE` with < 128, but is this desired?

3. **Should we deprecate `Tag.BUILTIN`?**
   - After extension, `Tag.CODE` can handle both builtins and user code
   - But `Tag.BUILTIN` is simpler (no encoding/decoding)
   - Recommendation: Keep both, use `Tag.BUILTIN` for builtins, `Tag.CODE` for user code (and now also builtins if desired)

---

## Benefits

1. **Unified dispatch:** `Tag.CODE` can represent both builtins and user code
2. **Flexibility:** Symbols can be stored as `Tag.CODE` regardless of type
3. **Backward compatible:** Existing code continues to work
4. **No breaking changes:** `Tag.BUILTIN` still works as before

---

## Risks

1. **Performance:** Extra decode + comparison for every `Tag.CODE` dispatch
2. **Confusion:** Two ways to represent builtins (`Tag.BUILTIN` and `Tag.CODE` < 128)
3. **Testing:** Need to ensure all code paths handle both cases correctly
