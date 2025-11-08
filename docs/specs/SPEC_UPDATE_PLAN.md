# Specification Update Plan

**Created:** 2024-12-19  
**Purpose:** Track remaining work to bring all specs to current implementation state

## Completed Updates ✅

1. ✅ **vm-architecture.md** - Updated reference helpers to absolute-only model
2. ✅ **variables-and-refs.md** - Fixed opcode names (Reserve, InitVar, VarRef)
3. ✅ **variables-and-refs.md** - Removed outdated GLOBAL_REF migration note
4. ✅ **capsules.md** - Fixed SEG_RSTACK reference, updated to absolute addressing
5. ✅ **capsules.md** - Fixed Op.EndDef → Op.EndDefinition
6. ✅ **finally.md** - Added prominent "NOT YET IMPLEMENTED" warning

## Remaining Tasks

### High Priority

1. ✅ **variables.md scope clarification** - RESOLVED
   - **Action Taken:** Moved to `docs/reference/dictionary-implementation.md`
   - **Rationale:** Contains implementation details (dictionary structure, heap internals) that complement but don't duplicate the user-facing spec
   - **Status:** Clear separation achieved - implementation reference vs user-facing specification

2. **Complete lists.md review**
   - **Status:** Partial review completed (first 100 lines verified)
   - **Remaining:** ~400 lines need verification
   - **Focus areas:**
     - Buffer operations (mentioned in opcodes, verify against spec)
     - Advanced traversal patterns
     - Edge cases and error conditions

### Medium Priority

3. **quick-reference.md review**
   - **Action:** Review after all other specs finalized
   - **Goal:** Ensure quick reference accurately summarizes current state
   - **Check:** All opcode names, syntax examples, lowering patterns

4. **Cross-reference verification**
   - **Action:** Verify all cross-references between specs are accurate
   - **Check:** Links to other specs, code examples, opcode references

### Low Priority

5. **Documentation cleanup**
   - Remove any remaining migration notes
   - Standardize terminology across all specs
   - Ensure consistent formatting

## Implementation Status Summary

### Fully Implemented ✅
- Core VM architecture
- Tagged values and NaN-boxing
- Variables (locals and globals)
- References (DATA_REF unified model)
- Lists (reverse layout, traversal)
- Metaprogramming (immediate words, control flow)
- Capsules (constructor, dispatch)
- Global heap operations (gpush, gpop, gpeek, gmark, gsweep)

### Not Yet Implemented ❌
- Finally blocks (ERR/IN_FINALLY registers, wrapper rebinding)

### Partially Implemented ⚠️
- Buffers (opcodes exist, need to verify full spec compliance)

## Next Steps

1. ✅ Moved variables.md to docs/reference/dictionary-implementation.md
2. Complete lists.md full review
3. Verify buffer implementation against any buffer spec
4. Update quick-reference.md
5. Final cross-reference check


