# TACIT Capsules Implementation Plan

## Overview

This plan outlines the step-by-step implementation of TACIT capsules, breaking down a complex feature into manageable prerequisites and phases.

## Terminology Decision

## Prerequisites Assessment

### Already Implemented ✅
- [x] Lists with LINK navigation
- [x] Maplists with key-value lookup
- [x] Symbol table and `@symbol` references
- [x] Basic method dispatch via `eval`
- [x] Stack manipulation operations

### Needs Implementation 🔧

#### Phase 1: Core Infrastructure (Decomposed)
✅ **COMPLETED: Step 1.1: Add Receiver Register to VM**
   - ✅ Add `receiver: number` field to VM state (slot index, defaults to 0)
   - ✅ Add getter/setter methods for receiver access
   - ✅ Ensure receiver is included in VM reset operations

2. **Step 1.2: Basic List Access Opcodes**
   - `element` opcode: `( index — slot )` traverses list to find element slot
   - `get` opcode: `( slot — value )` reads value from memory slot
   - `set` opcode: `( value slot — )` writes value to memory slot
   - `find` opcode: `( symbol — slot )` searches maplist for key, returns value slot

3. **Step 1.3: Basic Method Dispatch**
   - `dispatch` builtin: `( method-symbol — ... )` uses receiver register
   - Uses `find` to lookup method in receiver element 0
   - Uses `get` to get method code reference
   - Error handling for missing methods
   - No context stacking yet - keep it simple

4. **Step 1.4: Manual Capsule Construction (Later)**
   - Functions to build capsule lists manually
   - Validation of capsule structure
   - Basic field access by index

#### Phase 2: Field System
4. **Field Access Primitives**
   - `getFieldOp <field-index>` builtin: `( — value )` reads from receiver register
   - `setFieldOp <field-index>` builtin: `( new-value — )` writes to receiver register
   - **Field addressing**: `slot = receiver_address + dispatch_maplist_length + field_index`
   - **Performance**: O(1) direct slot access using calculated field positions
   - Bounds checking and error handling

5. **Receiver Context Operations**
   - Receiver context automatically managed during method dispatch
   - Nested call support through receiver stack in VM
   - Context restoration on method return

#### Phase 3: Syntax Support  
6. **`.method` Sigil Implementation**
   - Tokenizer support for `.method` syntax
   - Parser integration
   - Compilation to receiver dispatch

7. **`with` Combinator**
   - Block syntax parsing `{ ... }`
   - Receiver context management
   - Nested context support

#### Phase 4: Definition Syntax
8. **Field Declaration System**
   - `field` builtin for declaring fields
   - Offset tracking during compilation
   - Symbol resolution for field names

9. **`capsule/end` Definition**
   - Dictionary marker management
   - Phase-based compilation (collect → compile → assemble)
   - Prototype construction

#### Phase 5: Advanced Features
10. **Default Method Support**
    - Integration with maplist `default` key convention
    - Fallback dispatch mechanism

11. **Integration Testing**
    - Full capsule definition and usage
    - Nested dispatch scenarios
    - Performance validation

## Detailed Implementation Steps

### Phase 1: Core Infrastructure

#### Step 1.1: Receiver Register
```typescript
// In vm.ts
interface VMState {
  // ... existing fields
  receiver: TaggedValue | null;  // Current receiver object
  receiverStack: TaggedValue[];  // For nested contexts
}
```

#### Step 1.2: Manual Construction Functions
```tacit
: make-capsule ( method-maplist field1 field2 ... fieldN n — capsule )
  # Create list with n+1 elements (maplist + n fields)
  # Validate maplist structure
  # Return properly structured capsule
;

: capsule-valid? ( capsule — boolean )
  # Check element 0 is maplist
  # Verify even number of maplist entries
  # Validate structure integrity
;
```

#### Step 1.3: Basic Method Dispatch
```tacit
: dispatch ( method-symbol — ... )
  # Get receiver from VM receiver register
  # Extract maplist from receiver element 0
  # Look up method-symbol in maplist
  # If found: eval code reference (receiver context already set)
  # If not found: check for 'default method or error
  # Receiver context maintained throughout call
;
```

### Phase 2: Field System

#### Step 2.1: Field Access Primitives
```tacit
getFieldOp <field-index>     # ( — value ) Get field from receiver register
setFieldOp <field-index>     # ( new-value — ) Set field in receiver register
```

**Implementation details**:
- `<field-index>` is an immediate operand following the opcode (0-based field index)
- Receiver comes from VM register, not stack
- **Slot calculation**: `slot = receiver_address + dispatch_maplist_length + field_index`
- **Dispatch maplist length**: Available from maplist header in receiver element 0
- **Field addressing**: Direct O(1) slot access without traversal
- Validate receiver is capsule before field access
- Check field index bounds against known field count
- Handle out-of-bounds with NIL for gets
- Preserve list structure for sets

**Performance advantages**:
- O(1) field access using calculated slot positions
- No list traversal required after initial setup
- Efficient for frequent field operations
- Compatible with single-pass compilation (field indices assigned during declaration)

**Compiler strategy**:
- Fields get indices 0, 1, 2... during declaration
- No forward reference problem (indices independent of dispatch maplist size)
- Runtime calculates actual slot positions using receiver and maplist info
```

#### Step 2.2: Receiver Context Operations
```tacit
# Receiver context is managed automatically by the VM:
# - Method dispatch saves current receiver to receiver stack
# - Sets new receiver during method execution  
# - Restores previous receiver on method return
# - Nested calls work through the receiver stack
```

### Phase 3: Syntax Support

#### Step 3.1: `.method` Sigil
- Modify tokenizer to recognize `.method` patterns
- Create `DOT_METHOD` token type
- Compile to: `'method dispatch` (receiver already in register)

#### Step 3.2: `with` Combinator
- Parse `with { ... }` syntax
- Compile to receiver context management within the `with` operation
- Handle nested blocks correctly through receiver stack

### Phase 4: Definition Syntax

#### Step 4.1: Field Declaration
```tacit
: field ( value name — )
  # In compilation mode only
  # Store value temporarily in compilation context
  # Record field name with next available field index (0, 1, 2...)
  # Increment field counter
;
```

#### Step 4.2: Capsule Definition
```tacit
: capsule ( name — )
  # Mark dictionary position
  # Enter capsule compilation mode
  # Initialize field counter at 0 (first field gets index 0)
  # Set compilation context
;

: end ( — capsule )
  # Walk dictionary from marker
  # Collect field declarations → values list (elements 1..N)
  # Collect method definitions → maplist (element 0)
  # Assemble capsule: ( maplist field1 field2 ... fieldN )
  # Install in dictionary as single definition
  # Exit compilation mode
;
```

**Single-pass compilation strategy**:
1. **Field phase**: Assign field indices 0, 1, 2... as fields are declared
2. **Method phase**: Compile methods using field indices for field access opcodes
3. **Assembly phase**: Build dispatch maplist from collected methods, place at element 0
4. **Runtime**: Calculate actual slot positions using `receiver_address + maplist_length + field_index`
5. **Result**: O(1) field access with no forward reference compilation issues

## Testing Strategy

### Unit Testing by Phase
1. **Phase 1**: Manual capsule construction and basic dispatch
2. **Phase 2**: Field access and receiver context management  
3. **Phase 3**: Syntax parsing and sigil compilation
4. **Phase 4**: Full definition syntax and compilation
5. **Phase 5**: Advanced features and edge cases

### Integration Testing
- Nested `with` blocks
- Inter-method calls within capsules
- Capsule field mutation and structure preservation
- Integration with existing list/maplist operations
- Performance benchmarks

## Migration Considerations

### Terminology Updates
- Update all specifications to use "receiver" instead of "self"
- Update glossary and documentation
- Ensure consistent terminology across codebase

### Backward Compatibility
- New features should not break existing list/maplist functionality
- Capsules should be fully compatible with list operations
- Field access should integrate with future variable systems

### Performance Targets
- Method dispatch: O(n/2) where n is number of methods
- Field access: O(1) with runtime slot calculation (`receiver + maplist_length + field_index`)
- Context switching: Minimal overhead (register operations)

## Dependencies and Risks

### Critical Dependencies
1. **Stable list/maplist infrastructure** - foundation must be solid
2. **Symbol table integration** - method names as symbols
3. **VM register management** - receiver context handling
4. **Parser extensibility** - new syntax support

### Technical Risks
1. **Compilation complexity** - multi-phase capsule assembly
2. **Context management** - nested receiver handling
3. **Memory efficiency** - avoiding unnecessary copying
4. **Integration complexity** - syntax and semantic interaction

### Mitigation Strategies
1. **Incremental development** - each phase independently testable
2. **Comprehensive testing** - unit tests for each component
3. **Performance monitoring** - benchmark each phase
4. **Documentation** - clear specifications for each feature

## Success Criteria

### Phase Completion Criteria
- [ ] Phase 1: Manual capsule construction and dispatch working
- [ ] Phase 2: Field access and receiver context operational
- [ ] Phase 3: Syntax support for `.method` and `with` blocks
- [ ] Phase 4: Complete `capsule/end` definition syntax
- [ ] Phase 5: Advanced features and full integration

### Overall Success Metrics
- All existing tests continue passing
- Capsule feature tests achieve 100% coverage
- Performance benchmarks meet targets
- Documentation complete and accurate
- Integration with future variable system planned

## Estimated Timeline

- **Phase 1**: 2-3 weeks (foundation critical)
- **Phase 2**: 1-2 weeks (building on Phase 1)  
- **Phase 3**: 2-3 weeks (syntax complexity)
- **Phase 4**: 2-3 weeks (compilation complexity)
- **Phase 5**: 1-2 weeks (polish and integration)

**Total**: 8-13 weeks depending on complexity discovered during implementation.

**Critical Path**: Receiver register → Manual construction → Field system → Syntax support → Definition compilation
