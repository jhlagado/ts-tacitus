# Plan 40: Top-Level Variables

## Status & Context

- **Stage:** Draft (design approved)
- **Priority:** High - Fixes storage collision bug, enables top-level variables
- **Spec:** `docs/specs/top-level-variables.md`
- **Background:** Current implementation doesn't allow `var` at top level, and the global implementation has a storage collision bug (GP=0 overwrites slot 0).

## Goals

1. Enable `var` declarations at top-level (stored in root frame on return stack)
2. Fix storage collision by using hybrid storage (slots on return stack, compounds in global segment)
3. Maintain same `var` syntax as function-local variables

## Non-Goals

- Global promotion keyword (deferred to future plan)
- Making top-level vars visible in functions
- Automatic reclamation of top-level variables

## Deliverables

- Root frame initialization on return stack for top-level execution
- Parser changes to allow top-level `var` declarations
- Hybrid storage: slots on return stack, compounds at GP in global segment
- Updated tests demonstrating top-level variables
- Updated documentation

---

## Phase 0: Root Frame Setup

| Step | Description | Status |
| ---- | ----------- | ------ |
| 0.1  | Add VM initialization to create root frame on return stack | ☐ |
| 0.2  | Set BP to RSTACK_BASE at VM start | ☐ |
| 0.3  | Add topLevelLocalCount tracking to VM | ☐ |
| 0.4  | Ensure root frame persists across top-level code execution | ☐ |

_Exit criteria:_ Root frame exists and persists for program duration.

---

## Phase 1: Parser Changes

| Step | Description | Status |
| ---- | ----------- | ------ |
| 1.1  | Modify `emitVarDecl` to allow top-level declarations | ☐ |
| 1.2  | Add symbol table support for top-level locals | ☐ |
| 1.3  | Emit InitVar for top-level (targets root frame) | ☐ |
| 1.4  | Test simple value declaration at top-level | ☐ |

_Exit criteria:_ Can declare and use simple-valued variables at top-level.

---

## Phase 2: Compound Storage

| Step | Description | Status |
| ---- | ----------- | ------ |
| 2.1  | Verify InitVar handles compound values correctly | ☐ |
| 2.2  | Ensure compounds go to GP in global segment | ☐ |
| 2.3  | Ensure slot holds GLOBAL_REF to compound | ☐ |
| 2.4  | Test list storage at top-level | ☐ |
| 2.5  | Test capsule storage at top-level | ☐ |

_Exit criteria:_ Compounds store correctly with no collision.

---

## Phase 3: Fix Storage Collision Bug

| Step | Description | Status |
| ---- | ----------- | ------ |
| 3.1  | Verify GP starts at 0 (no slot reservation needed) | ☐ |
| 3.2  | Test that list-to-var works (original bug case) | ☐ |
| 3.3  | Test that capsule-to-var works | ☐ |
| 3.4  | Verify no collision between slots and GP | ☐ |

_Exit criteria:_ Storage collision bug resolved; compounds work correctly.

---

## Phase 4: Test Suite

| Step | Description | Status |
| ---- | ----------- | ------ |
| 4.1  | Create tests for simple top-level variables | ☐ |
| 4.2  | Create tests for compound top-level variables | ☐ |
| 4.3  | Test scope isolation (top-level vars not in functions) | ☐ |
| 4.4  | Test interaction with function calls | ☐ |
| 4.5  | Run full test suite and verify no regressions | ☐ |

_Exit criteria:_ Comprehensive test coverage; all tests pass.

---

## Phase 5: Documentation

| Step | Description | Status |
| ---- | ----------- | ------ |
| 5.1  | Finalize `top-level-variables.md` spec | ☐ |
| 5.2  | Update `variables-and-refs.md` with top-level info | ☐ |
| 5.3  | Update tutorial examples | ☐ |
| 5.4  | Add examples to learn docs | ☐ |

_Exit criteria:_ Complete documentation of top-level variables.

---

## Implementation Notes

### Key Design Points

1. **Root Frame**: Top-level code executes in persistent frame on return stack
2. **Hybrid Storage**: Slots on return stack, compounds in global segment
3. **No Collision**: Slots and GP are in separate memory segments
4. **Scope**: Top-level vars not visible in function definitions

### Critical Implementation Areas

**Parser Changes (src/lang/parser.ts):**
- Modify `emitVarDecl` to detect top-level context
- Track top-level locals separately
- Emit InitVar targeting root frame for top-level
- Preserve existing function-local behavior

**VM Initialization (src/core/vm.ts):**
- Initialize BP to RSTACK_BASE for root frame
- Add topLevelLocalCount tracking
- Ensure root frame persistence

### Storage Layout

**Before (Broken):**
```
Global Segment:
  [0]: glist slot (should be variable)
  [0-3]: List data (overwrites slot!)  ← COLLISION
```

**After (Fixed):**
```
Return Stack (Root Frame):
  [BP+0]: glist = GLOBAL_REF(0)  ← Slot

Global Segment:
  [0-2]: List payload
  [3]: List header  ← GP points here
```

### Test Cases

```tacit
# Simple value
10 var x
x .  # 10

# Compound
( 1 2 3 ) var mylist
mylist length .  # 3

# Capsule
make-counter var c
'inc c dispatch
'get c dispatch .  # 1
```

## Success Criteria

- [ ] Can declare variables at top-level with `var`
- [ ] Simple values work correctly
- [ ] Compounds (lists, capsules) work correctly
- [ ] No storage collision
- [ ] Top-level vars scoped correctly (not visible in functions)
- [ ] All existing tests still pass
- [ ] Documentation complete

## Future Work

- Plan 41: Global promotion keyword to make top-level vars permanent/visible
- Consider allowing optional function access to top-level vars
- Implement variable deletion/reclamation
