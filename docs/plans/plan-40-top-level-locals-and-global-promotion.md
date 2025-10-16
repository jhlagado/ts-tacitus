# Plan 40: Top-Level Locals and Global Promotion

## Status & Context

- **Stage:** Draft (design approved)
- **Priority:** High - Fixes critical bug in global variable implementation
- **Spec:** `docs/specs/global-variables.md`
- **Background:** Current global implementation has storage collision bug (GP=0 overwrites slot 0). This plan implements a proper separation between top-level locals and promoted globals.

## Goals

1. Enable `var` declarations at top-level (stored in root frame on return stack)
2. Implement `global` keyword to promote top-level locals to global segment
3. Fix storage collision between variable slots and compound storage
4. Maintain backward compatibility where possible

## Non-Goals

- Automatic promotion of top-level locals
- Deletion of globals
- Shadowing rules between top-level and function scopes (deferred to future plan)

## Deliverables

- Root frame initialization on return stack for top-level execution
- Parser changes to allow top-level `var` declarations
- New `global` promotion semantics (operates on existing local)
- Updated symbol table to track top-level locals separately
- Migration of existing tests to new syntax
- Updated documentation

---

## Phase 0: Root Frame Setup

| Step | Description | Status |
| ---- | ----------- | ------ |
| 0.1  | Add VM initialization to create root frame on return stack | ☐ |
| 0.2  | Set BP to root frame base at VM start | ☐ |
| 0.3  | Track root frame slot count separately from GP | ☐ |
| 0.4  | Ensure root frame persists across top-level code execution | ☐ |

_Exit criteria:_ Root frame exists and can hold local variables for top-level code.

---

## Phase 1: Top-Level Local Variables

| Step | Description | Status |
| ---- | ----------- | ------ |
| 1.1  | Modify `emitVarDecl` to allow top-level declarations | ☐ |
| 1.2  | Update symbol table to track top-level locals with LOCAL tag | ☐ |
| 1.3  | Implement root frame slot allocation (similar to function locals) | ☐ |
| 1.4  | Test simple value storage in root frame | ☐ |
| 1.5  | Test compound value storage (RSTACK_REF in slot, payload on return stack) | ☐ |

_Exit criteria:_ Can declare and use variables at top-level with `var` keyword.

---

## Phase 2: Global Promotion Keyword

| Step | Description | Status |
| ---- | ----------- | ------ |
| 2.1  | Implement new `global` semantics (operates on top-level local) | ☐ |
| 2.2  | Add `promoteToGlobal` function to copy value to global segment | ☐ |
| 2.3  | Update symbol table entry from LOCAL to GLOBAL_REF | ☐ |
| 2.4  | Handle simple value promotion (direct copy to GP) | ☐ |
| 2.5  | Handle compound promotion (copy payload to GP, store GLOBAL_REF) | ☐ |

_Exit criteria:_ `global` keyword promotes top-level local to persistent global storage.

---

## Phase 3: Combined Syntax Support

| Step | Description | Status |
| ---- | ----------- | ------ |
| 3.1  | Support `var x global` syntax (declare and immediately promote) | ☐ |
| 3.2  | Ensure backward compatibility with existing global usage | ☐ |
| 3.3  | Add deprecation warnings for old syntax if needed | ☐ |

_Exit criteria:_ Both new and legacy syntax work correctly.

---

## Phase 4: Fix Storage Collision Bug

| Step | Description | Status |
| ---- | ----------- | ------ |
| 4.1  | Remove slot allocation from global segment | ☐ |
| 4.2  | Ensure GP starts at 0 (no reserved slot area needed) | ☐ |
| 4.3  | Verify compounds copy correctly to global segment | ☐ |
| 4.4  | Test list copy to global (original bug case) | ☐ |
| 4.5  | Test capsule copy to global | ☐ |

_Exit criteria:_ No storage collision; compounds in globals work correctly.

---

## Phase 5: Test Migration and Validation

| Step | Description | Status |
| ---- | ----------- | ------ |
| 5.1  | Update existing global variable tests to new syntax | ☐ |
| 5.2  | Create comprehensive tests for top-level locals | ☐ |
| 5.3  | Test promotion of various value types | ☐ |
| 5.4  | Re-enable `capsule-dispatch.global-ref.test.ts` | ☐ |
| 5.5  | Verify `list-to-global.test.ts` passes | ☐ |
| 5.6  | Run full test suite and verify no regressions | ☐ |

_Exit criteria:_ All tests pass; original bug resolved.

---

## Phase 6: Documentation

| Step | Description | Status |
| ---- | ----------- | ------ |
| 6.1  | Update `variables-and-refs.md` spec with top-level locals | ☐ |
| 6.2  | Finalize `global-variables.md` spec | ☐ |
| 6.3  | Update tutorial examples using new syntax | ☐ |
| 6.4  | Add migration guide for users | ☐ |

_Exit criteria:_ Complete documentation of new global variable system.

---

## Implementation Notes

### Key Insights from Design Session

1. **Root Frame**: Top-level code executes in a persistent frame on return stack
2. **Dynamic Allocation**: Top-level locals allocated as encountered (no pre-scanning)
3. **Promotion**: `global` keyword copies value to global segment and updates symbol table
4. **No Collision**: Locals on return stack, globals in global segment (separate spaces)

### Critical Changes

**Parser (src/lang/parser.ts):**
```typescript
// OLD: throw error if not in function
export function emitVarDecl(state: ParserState): void {
  if (!state.currentDefinition) {
    throw new SyntaxError(...);
  }
  // ...
}

// NEW: allow at top-level
export function emitVarDecl(state: ParserState): void {
  if (!state.currentDefinition) {
    // Allocate in root frame
    vm.rootFrameLocals++;
    // emit InitVar for root frame slot
    return;
  }
  // ... function local logic
}
```

**Global Promotion:**
```typescript
export function emitPromoteGlobal(state: ParserState): void {
  // Expect variable name
  const nameToken = state.tokenizer.nextToken();
  const varName = nameToken.value as string;
  
  // Must be top-level local
  const entry = vm.symbolTable.findEntry(varName);
  if (!entry || entry.tag !== Tag.LOCAL) {
    throw new Error('Can only promote top-level locals');
  }
  
  // Emit runtime promotion: reads local, copies to GP, updates symbol table
  vm.compiler.compileOpcode(Op.PromoteGlobal);
  vm.compiler.compile16(entry.slotNumber);
}
```

### Storage Layout Examples

**Before Promotion:**
```
Return Stack:
  [BP] Slot 0: x = 10
  [BP+1] Slot 1: y = RSTACK_REF(BP+2)
  [BP+2] List: [1, 2, 3]
  
Global Segment:
  [empty
