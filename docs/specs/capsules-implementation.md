# TACIT Capsules Implementation

## Terminology

### Stack vs List Structure
- **Stack Cell**: Single 32-bit tagged value position on the VM stack
- **List Element**: Variable-length data item within a list structure  
- **Field Offset**: Numeric position of field data within capsule (starting at 1)

A single list element may occupy multiple stack cells if it contains compound data (nested lists).

### Field Access Compilation

Field access compiles to fixed offsets:
```tacit
firstName           \ Compiles to: self 1 get
lastName            \ Compiles to: self 2 get
100 -> viewCount    \ Compiles to: 100 self 3 set
```

The field offset is determined at compile time and stored in the compilation context.

## Declaration Rules and Ordering

- **Field declarations must precede method declarations** if methods reference those fields
- Field names are **relative to `self`** and valid only within capsule scope  
- Field declarations shadow global names using standard Forth dictionary behavior
- Methods may access fields directly (symbolic name)
- All methods compiled with visibility into current capsule's fields at compilation time
- Forward references to fields not yet declared will cause compilation errors

## Field Declaration Semantics

The `field` keyword does not allocate a global variable. Instead, it:
- Pops a value (simple or compound) from the stack
- Writes it temporarily into the dictionary entry (not the capsule yet)
- Associates the name with an **offset** stored in compiler environment
- Allows symbolic references to be resolved during method compilation

Each field becomes an **element** in the prototype list, with offset starting at 1 (element 0 reserved for dispatch maplist).

### Field Value Storage
- Field values stored during `end` processing by reading dictionary
- Compiler walks dictionary to collect all `field` entries  
- Emits stored values to data stack in offset order
- Only simple values and tagged LIST objects allowed as field values
- Each list must be properly tagged with inline length and backlink

## Declaration Rules and Ordering

- **Field declarations must precede method declarations** if methods reference those fields
- Field names are **relative to `self`** and valid only within capsule scope  
- Field declarations shadow global names using standard Forth dictionary behavior
- Methods may access fields directly (symbolic name)
- All methods compiled with visibility into current capsule's fields at compilation time
- Forward references to fields not yet declared will cause compilation errors

## Method Dispatch Implementation

### Dispatch Mechanism
```tacit
.methodName    \ Expands to: self 0 get `methodName maplist-find eval
```

**Process**:
1. Prefix sigil `.` reads next token as method name
2. Access maplist from `self` element 0
3. Search for method symbol in maplist
4. If found, execute corresponding code reference
5. If not found, try `default` method or signal error
6. **Receiver unchanged** - stays accessible via `self`

### TACIT Sigil Family
```tacit
@coderef     \ Code reference sigil
`symbol      \ Symbol literal sigil  
.method      \ Method dispatch sigil (within 'with' context)
```

## Field Visibility Rules

- Fields must be declared before methods that reference them
- Methods can only access fields declared earlier in the definition  
- Methods compiled before a field is declared will not have access to it
- This enforces one-pass, forward-declaration rule consistent with Forth tradition

## Structural vs Element Mutability

Following list mutability semantics:
- **Fields can be mutated** using `->` operator (efficient, O(1))
- **Structure is immutable** - adding/removing fields requires new capsule
- **Compound field values** follow their own mutability rules  
- **No in-place modification** of capsule structure itself

## Compilation Process

The compiler processes capsule definitions in phases:

### Phase 1: Declaration Collection
When `capsule <name>` is encountered:
1. Mark current dictionary position as marker
2. Enter capsule compilation mode  
3. Record capsule name in compilation context
4. Collect field and method definitions in forward order

### Phase 2: Field Processing  
Each `field` declaration:
1. Assigns sequential element offset (starting at 1)
2. Records field name and offset in compilation context
3. Stores initial value temporarily in dictionary entry
4. Field names shadow global names using standard Forth rules

### Phase 3: Method Compilation
Each method definition:
1. Compiles as standard TACIT function with capsule context
2. Resolves field references to fixed offsets using stored mappings
3. Field symbols marked with flag for relative addressing  
4. Creates code reference for dispatch table entry

### Phase 4: Prototype Assembly
At `end`:
1. Walk dictionary backward from current head to marker
2. Collect methods into maplist: `( `name1 @method1 `name2 @method2 ... )`
3. Collect field values in declaration order (elements 1..N)
4. Build prototype list on data stack: `( ( `name1 @method1 `name2 @method2 ... ) field1 field2 ... )`
5. Replace dictionary entries with single capsule definition
6. Clean up intermediate field/method definitions (optional)

### Detailed Implementation Rules

#### Dictionary Walking Algorithm
- Store dictionary head pointer at `capsule <name>`
- All subsequent entries tagged as part of this capsule
- At `end`, walk backward identifying field vs method entries
- Differentiate via flags/metadata in dictionary entries

#### Field Offset Resolution  
- Offsets start at 1 (element 0 reserved for dispatch maplist)
- Each `field` increments internal counter
- Offset stored in dictionary entry under field name
- Used during method compilation for symbol resolution

#### Stack Semantics for Fields
- `field` pops value from stack, stores in dictionary temporarily
- Field values emitted to data stack in offset order during `end`
- Only simple values and tagged LIST objects allowed as field values

#### Symbol Resolution in Methods
- During method compilation, determine if symbol is field (relative) or global (absolute)
- Field references compile to: `self <offset> get` 
- Field assignments compile to: `<value> self <offset> set`
- Forward references to fields not yet declared cause compilation error

## Performance Characteristics

### Field Access
- **Read**: O(1) with compile-time offset resolution
- **Write**: O(1) direct element assignment

### Method Dispatch
- **Search**: O(n/2) linear search through maplist
- **Optimization**: Can use sorted maplists or hash-based dispatch

### Instantiation
- **Copy**: O(n) where n is number of fields
- **Allocation**: Direct stack copying, no heap overhead

## Memory Management

- **Zero copying** - receiver never duplicated during `with` blocks
- **Stack efficiency** - no `dup` operations required
- **Minimal overhead** - context saving uses VM registers
- **Forth-compatible** - aligns with traditional Forth memory patterns

## Implementation Strategy

### Phase 1: Basic Dispatch
Implement traditional dispatch:
```tacit
instance `method dispatch
```

### Phase 2: `with` Blocks
Add context-based dispatch:
```tacit
instance with
  `method dispatch
end
```

### Phase 3: `.` Sigil Syntax
Add prefix sigil for method calls:
```tacit
instance with {
    .method
}
```

## Related Specifications

- `docs/specs/capsules-overview.md` - High-level capsule concepts
- `docs/specs/lists.md` - Foundational list mechanics
- `docs/specs/maplists.md` - Key-value dispatch tables
