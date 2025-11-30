# Tacit Code Style Guide

## Core Principles

### Naming Philosophy

- **Terse over verbose**: Prefer short, single-syllable names. Maximum 3 syllables for less common cases.
- **No Java-style sentences**: Avoid long camelCase names that read like sentences.
- **Functional clarity**: Names should convey purpose, not implementation details.

## Function Naming Rules

### Public Functions

- **Ops**: Imperative Tacit word + `Op` suffix
  - ✅ `fetchOp`, `printOp`, `selectOp`, `loadOp`
  - ❌ `fetchValueOp`, `printValueOperation`, `selectElementOperation`

- **Helpers**: 1-2 word camelCase, max 3 syllables total
  - ✅ `getListBounds`, `readRef`, `writeRef`, `isList`, `getTag`
  - ❌ `getListHeaderAndBaseAddress`, `readReferenceValue`, `isListHeaderValue`

- **Utilities**: Short, domain-specific names
  - ✅ `gpushList`, `rpushList`, `dropList`, `peek`, `pop`, `push`
  - ❌ `pushListToGlobalHeap`, `pushListToReturnStack`, `dropListFromStack`

### Private/Internal Functions

- Same rules apply, but can be even shorter if context is clear
- ✅ `ensureCap`, `checkInv`, `read8`, `readF32`
- ❌ `ensureGlobalHeapCapacity`, `checkInvariantsAreValid`, `read8BitValueFromCode`

## Variable Naming Rules

### Local Variables

- **Short and contextual**: Single letters OK in tight loops, otherwise 1-2 syllables
  - ✅ `i`, `j`, `k` (loop indices), `vm`, `val`, `ref`, `idx`, `addr`, `cell`
  - ❌ `index`, `value`, `reference`, `address`, `cellIndex` (unless needed for clarity)

- **Compound names only when necessary**: Prefer short names over descriptive ones
  - ✅ `absAddr`, `relCell`, `slotIdx`, `headerVal`
  - ❌ `absoluteAddress`, `relativeCellIndex`, `slotIndex`, `headerValue`

### Constants

- **UPPER_SNAKE_CASE**: Standard convention
  - ✅ `CELL_SIZE`, `STACK_BASE`, `GLOBAL_TOP`
  - ❌ `CellSize`, `stackBase`, `globalTop`

## Comments and Documentation

### JSDoc Comments

- **Required for public functions**: All exported functions must have JSDoc
- **Stack effects**: Include stack effect notation for ops: `( before -- after )`
- **Brief descriptions**: One line summary, then details if needed

```typescript
/**
 * Reads value from memory using a REF.
 * @param vm - VM instance
 * @param ref - REF tagged value
 * @returns Value read from memory
 */
export function readRef(vm: VM, ref: number): number {
```

### Inline Comments

- **Avoid noise**: Don't state the obvious
  - ❌ `// Increment the counter`
  - ❌ `// Read the value from memory`
  - ❌ `// Check if value is a list`

- **Explain why, not what**: Focus on non-obvious logic
  - ✅ `// Convert relative to absolute: BP is byte-based, RSP is cell-based`
  - ✅ `// Empty list optimization: skip payload copy`
  - ✅ `// Sentinel wildcard: DEFAULT matches any discriminant`

- **Remove AI-generated noise**: Delete comments that just restate the code

## Code Organization

### File Structure

- **One concept per file**: Keep files focused
- **Exports at top**: Re-export commonly used utilities
- **Helpers before main logic**: Utility functions before primary functions

### Function Length

- **Prefer short functions**: 20-30 lines max for most functions
- **Extract helpers**: If function exceeds 50 lines, consider splitting

### Repetition

- **DRY principle**: Don't repeat yourself
- **Extract common patterns**: If you see the same code 3+ times, extract it
- **Shared utilities**: Use shared helpers instead of duplicating logic

## Examples

### Good Examples

```typescript
/**
 * Pushes list to global heap.
 * Stack: ( list -- ref )
 */
export function gpushList(vm: VM): number {
  const header = peek(vm);
  const slots = getListLength(header);
  ensureCap(vm, slots + 1);
  const base = vm.gp;
  // ... copy logic ...
  return createGlobalRef(base + slots);
}

export function readRef(vm: VM, ref: number): number {
  const cell = getCellFromRef(ref);
  return vm.memory.readCell(cell);
}
```

### Bad Examples

```typescript
/**
 * Pushes a list from the data stack to the global heap and returns a reference.
 * This function transfers compound data from the data stack area to the global
 * heap area, allocating space and copying the payload.
 */
export function pushListToGlobalHeap(vm: VM): number {
  const listHeaderValue = peek(vm);
  const numberOfPayloadSlots = getListLength(listHeaderValue);
  ensureGlobalHeapCapacity(vm, numberOfPayloadSlots + 1);
  const destinationBaseCellIndex = vm.gp;
  // ... copy logic ...
  return createGlobalRef(destinationBaseCellIndex + numberOfPayloadSlots);
}

export function readReferenceValueFromMemory(vm: VM, reference: number): number {
  const absoluteCellIndex = getAbsoluteCellIndexFromReference(reference);
  return vm.memory.readCell(absoluteCellIndex);
}
```

## Migration Strategy

1. **New code**: Follow style guide strictly
2. **Refactoring**: Update names when touching code
3. **Gradual migration**: Don't do big-bang renames
4. **Documentation**: Update JSDoc as you go
5. **Tests**: Update test names to match

## Common Patterns to Refactor

### Long Function Names

- `getAbsoluteCellIndexFromRef` → `getCellFromRef` or `refToCell`
- `pushListToGlobalHeap` → `gpushList` (already done)
- `readReferenceValue` → `readRef`
- `writeReferenceValue` → `writeRef`
- `ensureGlobalHeapCapacity` → `ensureCap` (in context)

### Verbose Variable Names

- `absoluteCellIndex` → `absCell` or `cell`
- `relativeCellIndex` → `relCell` or `cell`
- `numberOfSlots` → `slots` or `n`
- `destinationBaseCellIndex` → `base` or `dest`
- `sourceBaseAddressBytes` → `srcBase` or `base`

### Redundant Comments

- Remove comments that just restate the code
- Remove AI-generated explanatory comments
- Keep only comments that explain "why" or non-obvious logic
