# Plan 16: Value-by-Default Local Variable Access & Reference System Audit

## Objective
Implement complete reference system per refs.md specification, bringing entire codebase into alignment with restructured reference semantics.

## Full Audit Requirements

### 1. Cross-Specification Alignment Audit
**Action Required**: Review and revise related specifications to align with refs.md:

#### A. Update `docs/specs/local-vars.md`
- **Section to revise**: Variable access semantics (currently describes ref-by-default)
- **Changes needed**: Update to value-by-default model, clarify `&x` sigil usage
- **Cross-references**: Ensure frame layout examples align with refs.md addressing

#### B. Update `docs/specs/access.md` 
- **Section to revise**: Path traversal with refs, get/set source resolution
- **Changes needed**: Clarify mandatory source resolution in `set` operations
- **Cross-references**: Ensure examples use `resolve` not `unref`

#### C. Update `docs/specs/polymorphic-operations.md`
- **Section to revise**: Reference handling across all ops
- **Changes needed**: Update function signatures, resolve vs unref terminology
- **Cross-references**: Align with refs.md polymorphism requirements

#### D. Update `docs/specs/lists.md`
- **Section to revise**: Reference materialization, compound storage
- **Changes needed**: Clarify ref vs value semantics in list operations
- **Cross-references**: Ensure consistent with refs.md resolution rules

### 2. Implementation Gaps Analysis
**Action Required**: Comprehensive codebase audit for ref semantic compliance:

#### A. Parser/Compiler Layer (`src/lang/`)
- **Missing**: `&x` sigil parsing and compilation
- **Issue**: Bare local access compiles to ref-returning sequence
- **Fix required**: New compilation paths for value vs ref access

#### B. Operation Layer (`src/ops/`)
- **Current issue**: Some ops may not handle source ref resolution correctly
- **Audit needed**: All ops that write/store values
- **Fix required**: Ensure mandatory resolution boundaries are enforced

#### C. Error Handling (`src/core/errors.ts`)
- **Missing**: RefEscapeError, IncompatibleCompoundAssignmentError classes
- **Issue**: Generic error messages instead of ref-specific ones
- **Fix required**: Add ref-specific error types per refs.md section 8

#### D. Return Path Enforcement
- **Missing**: Frame exit scanning for owned ref resolution
- **Issue**: Refs can escape their owning frames
- **Fix required**: VM return operation must scan and resolve owned refs

### 3. Detailed Implementation Steps

#### Phase 1: Foundation & Rename (COMPLETED)
- ✅ Rename `unrefOp` → `resolveOp` 
- ✅ Update builtins registry: `resolve` primary, `unref` alias
- ✅ Update all imports and references

#### Phase 2: Parser & Compiler Updates
1. **Add `&x` sigil parsing**:
   - Modify tokenizer to recognize `&` prefix
   - Update `processValue()` to handle `&variable` syntax
   - Compile `&x` as `VarRef` only (no Fetch)

2. **Fix bare local access**:
   - Modify local variable compilation in `processValue()`
   - Change `x` from `VarRef + Fetch` to `VarRef + Fetch + AutoResolve`
   - Implement `autoResolveOp` that materializes refs but passes through values

3. **Update assignment operator**:
   - Verify `->` operator handles ref sources correctly
   - Ensure sources are resolved before storage per refs.md

#### Phase 3: Operation Layer Compliance
1. **Audit all write operations**:
   - Review `storeOp`, `setOp`, assignment paths
   - Ensure sources are resolved before writing
   - Add ref-specific error messages

2. **Add missing error classes**:
   - `RefEscapeError` for frame escape attempts  
   - `IncompatibleCompoundAssignmentError` for type mismatches
   - Update error messages to be ref-aware

3. **Implement frame exit enforcement**:
   - Add return-time scanning in VM return path
   - Resolve owned refs, preserve borrowed refs
   - Add frame ownership tracking

#### Phase 4: Access Operations Complete Implementation  
1. **Complete `access-ops.ts`**:
   - Implement full path traversal in `getOp`
   - Implement complete `setOp` with source resolution
   - Add multi-step path handling per access.md

2. **Verify polymorphic operations**:
   - Audit all list ops for proper ref handling
   - Ensure `resolveReference()` used consistently
   - Test value/ref equivalence

#### Phase 5: Testing & Validation
1. **Comprehensive test suite**:
   - Value-by-default behavior for all local types
   - `&x` explicit reference access
   - Ref escape prevention
   - Polymorphic equivalence tests
   - Assignment resolution tests

2. **Migration validation**:
   - All existing tests pass with new semantics
   - Performance regression testing
   - Error message accuracy verification

### 4. Current Compilation vs Target

#### Current (Problematic)
```
x        → VarRef + Fetch        (returns ref for compounds)
&x       → [not implemented]
x -> y   → VarRef + Store        (works correctly)
```

#### Target (Spec Compliant)
```
x        → VarRef + Fetch + AutoResolve   (always returns value)
&x       → VarRef                         (returns RSTACK_REF)
x -> y   → VarRef + Store                 (unchanged - already correct)
```

### 5. Implementation Dependencies

#### New Opcodes Needed
- `AutoResolve` - materializes refs, passes through values
- Potentially `RefGuard` - validates ref types in strict mode

#### Parser Enhancements
- Tokenizer support for `&` prefix
- Sigil dispatch in `processValue()`
- Local symbol resolution for both forms

#### VM Enhancements  
- Frame ownership tracking for return-time scanning
- Enhanced error reporting with ref context

### 6. Specification Update Tasks

1. **local-vars.md**: Update variable access model, add `&x` examples
2. **access.md**: Clarify source resolution in `set`, update terminology
3. **polymorphic-operations.md**: Update function signatures, resolve terminology  
4. **lists.md**: Clarify ref materialization rules

### 7. Success Criteria

#### Functional Requirements
- `x` returns actual values for both simple and compound locals
- `&x` returns RSTACK_REF for explicit aliasing
- All polymorphic operations work identically with values and refs
- Refs cannot escape their owning frames
- Sources are resolved before assignment/storage

#### Quality Requirements  
- All existing tests pass with new semantics
- No performance regressions
- Clear, ref-aware error messages
- Complete specification alignment

#### Future Compatibility
- Foundation supports eventual removal of `ref`/`resolve` from language
- Internal optimization path preserved
- Migration path clear for users

## Notes
- `ref` and `resolve` operations will eventually be removed from user language
- References become purely internal VM optimization
- This plan maintains that future direction while implementing current requirements