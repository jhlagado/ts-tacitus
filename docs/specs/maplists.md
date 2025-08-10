# TACIT Maplists Specification

## Overview

**Maplists** are ordinary lists following a key-value alternating pattern, providing TACIT's primary associative data structure. They build on the foundational list infrastructure documented in `docs/specs/lists.md`.

## Foundational Dependencies

Maplists inherit all properties from TACIT lists:
- Header-at-TOS `LIST:s` representation (payload slot count `s`)
- Type-agnostic traversal by span encoded in compound headers
- Forward-only traversal from header
- Structural immutability (discouraged to modify structure)
- Element mutability (simple values can be updated in-place)
- Simple vs compound value distinctions

**Required reading**: `docs/specs/lists.md` for core list mechanics.

## Structure Convention

```tacit
( key1 value1 key2 value2 key3 value3 )
```

**Examples**:
```tacit
( `key1 100 `key2 200 `key3 300 )                    # Simple key-value pairs
( `name "John" `age 30 `skills ( "coding" "math" ) ) # Mixed value types
( 1 "one" 2 "two" 3 "three" )                       # Numeric keys
( `timeout 5000 `retries 3 `default "N/A" )          # With default fallback
```

## Key-Based Access

**Pattern**: Find the address of a value by key comparison (address-returning search)

```tacit
( `key1 100 `key2 200 `key3 300 ) `key2 find get      → 200
( 1 "one" 2 "two" 3 "three" ) 2 find get             → "two"
( `timeout 5000 `default "unknown" ) `missing find get → "unknown"
( `key1 100 `key2 200 ) `missing find                 → NIL
```

**Stack effect**: `( maplist key — addr | default-addr | NIL )`

**Algorithm**: Linear element-wise search through alternating pairs
1. Validate list header `LIST:s` at TOS
2. Traverse elements: compare keys at element positions 0, 2, 4, ...
3. On match, return the address of the corresponding value element (positions 1, 3, 5, ...)
4. If not found, search for `default` and return its value address if present
5. If no match and no `default`, return NIL (see `tagged.md`)

**Performance**: O(n/2) where n is the element count

**Error Handling**: No exceptions thrown — returns an address or NIL; pair with `get`/`set` from `lists.md`

## Key Constraints and Recommendations

**Key recommendations**:
- **Prefer simple values** for keys (efficient comparison)
- **Ensure uniqueness** for predictable behavior (except `default`)
- **Keep small** (typically ≤12 entries for linear search efficiency)
- **Use `default` key** for fallback values when lookup fails

**Value flexibility**:
- Values can be simple or compound
- Variable-length values supported (lists, nested maplists)
- No constraints on value types
- `default` value can be any type appropriate for the use case

**Example with compound values and defaults**:
```tacit
( `config ( `timeout 5000 `retries 3 ) `data ( 1 2 3 4 ) `default null )
( `error-404 "Not Found" `error-500 "Server Error" `default "Unknown Error" )
```

## Advanced Search Strategies

For larger datasets, different search words can implement optimized algorithms:

```tacit
# Linear search (default)
maplist key find         → O(n)

# Binary search (requires sorted keys)  
sorted-maplist key bfind → O(log n)

# Hash-based (requires preprocessing)
hash-maplist key hfind   → O(1) average
```

**Design principle**: Same interface, different algorithms based on data characteristics.

## NIL Value Semantics

See `docs/specs/tagged.md` for the NIL sentinel definition. Maplist lookups return NIL when no key is found and no `default` is present.

## Default Key Convention

**Purpose**: Provide fallback values for failed lookups using a special `default` key.

### Convention Rules

**Special key**: The symbol `default` is reserved for fallback behavior
- When a lookup fails to find the requested key
- The maplist is searched again for a `default` key
- If found, the `default` key's value is returned
- If no `default` key exists, normal failure behavior applies (null/error)

### Usage Patterns

```tacit
# Configuration with sensible defaults
( `port 8080 `host "localhost" `default "unset" )

# Method dispatch with fallback
( `init @init-fn `reset @reset-fn `default @default-handler )

# Language/locale lookups
( `en "Hello" `fr "Bonjour" `es "Hola" `default "Hello" )
```

### Lookup Behavior

```tacit
config `port find get     → 8080           # Found: address then get value
config `missing find get  → "unset"        # Not found: use default value
config `default find get  → "unset"        # Explicit default lookup
( `key1 100 ) `missing find → NIL           # No default: return NIL
```

**Implementation note**: The `default` key can be accessed explicitly like any other key, but serves a special role in failed lookups.

### NIL vs Default Behavior

- **Key found**: Return associated value
- **Key not found + `default` present**: Return `default` key's value  
- **Key not found + no `default`**: Return NIL (INTEGER tagged value, value 0)
- **Never throws exceptions**: Always returns a value (graceful degradation)

### Benefits

- **Graceful degradation**: Missing keys return NIL or default value, never errors
- **Consistent API**: Same `find` operation handles all cases (found/default/NIL)
- **Flexible fallbacks**: Default can be any appropriate value type
- **Optional behavior**: Only applies when `default` key is present
- **Stack safety**: No exceptions - always returns exactly one value

### Design Considerations

**Key uniqueness**: `default` should appear only once per maplist
**Search efficiency**: Implementation may optimize by checking `default` first or last
**Type consistency**: `default` value should be compatible with expected result types

## Use Case Guidelines

### When to Use Maplists

**Ideal scenarios**:
- Associative lookup needed
- Key-based access patterns
- Configuration data, properties, lookup tables
- Small datasets (≤12 entries typically)

**Examples**:
```tacit
# Configuration with fallbacks
( `timeout 5000 `retries 3 `debug true `default false )

# Object properties with missing value handling  
( `name "John" `age 30 `department "Engineering" `default "N/A" )

# Error code lookup tables
( `error-404 "Not Found" `error-500 "Server Error" `default "Unknown Error" )
```

### When to Use Regular Lists

**Better alternatives**:
- Sequential processing predominates
- Index-based access sufficient  
- Preserving insertion order critical
- Performance-critical iteration
- Large datasets requiring specialized indexing

## Common Operations

### Retrieval Operations

```tacit
maplist key find           # Address by key (or NIL)
maplist keys               # Extract all keys → ( key1 key2 key3 )
maplist values             # Extract all values → ( val1 val2 val3 )
```

### Construction Operations (optional)

These create new maplists and are not core primitives. Prefer address-based updates where possible.

```tacit
maplist key value assoc    # Add or update entry by creating a new maplist
maplist key dissoc         # Remove entry by creating a new maplist
maplist1 maplist2 merge    # Combine maplists into a new maplist
```

### Stack Effects

**Retrieval**:
- `( maplist key — addr | default-addr | NIL )`
- `( maplist — keys )`
- `( maplist — values )`

**Structural modifications**:
- `( maplist key value — new-maplist )`
- `( maplist key — new-maplist )`
- `( maplist1 maplist2 — merged-maplist )`

**Element mutations**:
- Prefer address-based updates via `find` + `set` from `lists.md`.

## Integration with List Operations

Maplists are lists with conventions, so all list operations work:

```tacit
( `a 1 `b 2 `c 3 ) 1 element get   → 1        # Access value element at index 1
( `a 1 `b 2 `c 3 ) elements        → 6        # Total elements (3 pairs × 2)
( `a 1 `b 2 `c 3 ) `b find get     → 2        # Access by key via address + get
10 ( `a 1 `b 2 `c 3 ) `b find set  # In-place update if simple; else no-op
```

**Dual access patterns**: Address-based element access pairs with `get`/`set`; key-based access uses `find` to obtain an address.

**Mutation efficiency**: Simple values can be updated in-place via `set` without structural changes; compounds are no-op targets.

## Performance Characteristics

### Access Patterns  
- **Key lookup**: O(n/2) average for linear search
- **Key iteration**: O(n) for all keys (positions 0, 2, 4, ...)
- **Value iteration**: O(n) for all values (positions 1, 3, 5, ...)
- **Element mutation**: O(n/2) to find key, O(1) to update value
- **Structural changes**: O(n) to create new maplist with modifications

### Optimization Guidelines
- **Small datasets**: Linear search sufficient (≤12 entries)
- **Medium datasets**: Consider pre-sorting for binary search
- **Large datasets**: Consider specialized data structures beyond maplists
- **Frequent access**: Cache frequently accessed values
- **Hot keys**: Place commonly accessed entries near the beginning

### Memory Efficiency
- **Zero overhead**: Maplists are just lists with conventions
- **Header-at-TOS**: Standard list header with contiguous payload
- **Flat structure**: No additional pointer indirection
- **Cache friendly**: Sequential memory access during traversal

## Design Philosophy

**Simplicity**: Maplists require no new infrastructure - they're lists with search conventions.

**Flexibility**: Same underlying structure supports multiple access patterns (index-based and key-based).

**Performance transparency**: Linear search characteristics are explicit and predictable.

**Composability**: Maplists work seamlessly with all list operations while adding associative capabilities.

**Gradual optimization**: Start with simple linear search, upgrade to more sophisticated algorithms when datasets grow larger.

This approach aligns with TACIT's philosophy of building complex functionality from simple, composable primitives.

## Implementation Examples

### Basic Key Search

```tacit
: find ( maplist key — addr | default-addr | NIL )
  # Validate LIST:s header at TOS
  # Traverse elements: check keys at positions 0,2,4,...
  # On match, return address of value element (1,3,5,...)
  # If not found, try `default` and return its value address
  # If still not found, return NIL
;
```

### Key Extraction

```tacit
: keys ( maplist — keys )
  # Iterate even positions (0,2,4,...) and copy keys to a new list
;
```

### Entry Addition

```tacit
: assoc ( maplist key value — new-maplist )
  # Check if key exists (update vs insert)
  # Create new list with modified/added entry
  # Preserve all other key-value pairs
  # Return new maplist
;
```

## Related Specifications

- `docs/specs/lists.md` - Foundational list mechanics (required reading)
- `docs/specs/stack-operations.md` - Stack manipulation rules
- `docs/specs/tagged.md` - Type system and sentinel values (NIL)
