# TACIT Maplists Specification

## Table of contents

1. Overview
2. Foundational Dependencies
3. Structure Convention
4. Key-Based Access
5. Advanced Search Strategies
6. NIL Value Semantics
7. Default Key Convention
8. Use Case Guidelines
9. Common Operations
10. Integration with List Operations
11. Performance Characteristics
12. Memory Efficiency
13. Design Philosophy
14. Implementation Examples
15. Related Specifications
16. Binary search (bfind)
17. Appendix A: Advanced find

## 1. Overview

**Maplists** are ordinary lists following a key-value alternating pattern, providing TACIT's primary associative data structure. They build on the foundational list infrastructure documented in `docs/specs/lists.md`.

## 2. Foundational Dependencies

Maplists inherit all properties from TACIT lists:
- Header-at-TOS `LIST:s` representation (payload slot count `s`)
- Type-agnostic traversal by span encoded in compound headers
- Forward-only traversal from header
- Structural immutability (discouraged to modify structure)
- Element mutability (simple values can be updated in-place)
- Simple vs compound value distinctions

**Required reading**: `docs/specs/lists.md` for core list mechanics.

## 3. Structure Convention

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

## 4. Key-Based Access

**Pattern**: Find the address of a value by key comparison (address-returning search)

```tacit
( `key1 100 `key2 200 `key3 300 ) `key2 find fetch    → 200
( 1 "one" 2 "two" 3 "three" ) 2 find fetch           → "two"
( `timeout 5000 `default "unknown" ) `missing find fetch → "unknown"
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

**Error Handling**: No exceptions thrown — returns an address or NIL; pair with `fetch`/`store` from `lists.md`

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

## 5. Advanced Search Strategies

For larger datasets, see Appendix A: Advanced find for optimized address-returning search variants (`bfind`, `hfind`). The primary interface remains `find`.

### Building hash indices (`hindex`)

#### Overview

`hindex` constructs an open-addressed hash index for a maplist to accelerate `hfind` lookups.

#### Stack effect

```
maplist  hindex                 ->  index
maplist  capacity  hindex       ->  index    \ capacity is power-of-two (optional)
```

#### Semantics

- Scans key/value pairs, computing an interned key identity (symbols) and a relative payload offset to each value element.
- Inserts `( keyId valueOffset )` into a power-of-two open-addressed table using linear probing; empty slots are `nil`.
- Records the `default` key's value offset if present.
- Produces an index object (a plain list) that can be passed to `hfind`.

#### Usage with `hfind`

```
maplist  key  index  hfind   ->  addr | default-addr | nil
```

#### Validation and errors

- Non-maplist input or odd payload (not pairs) → error/sentinel.
- Capacity must be a power of two if provided.
- `hfind` must receive a valid index built for the specific maplist; otherwise it returns `nil`.

## 6. NIL Value Semantics

See `docs/specs/tagged.md` for the NIL sentinel definition. Maplist lookups return NIL when no key is found and no `default` is present.

## 7. Default Key Convention

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
config `port find fetch   → 8080           # Found: address then fetch value
config `missing find fetch → "unset"       # Not found: use default value
config `default find fetch → "unset"       # Explicit default lookup
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

## 8. Use Case Guidelines

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

## 9. Common Operations

### Retrieval Operations

```tacit
maplist key find           # Address by key (or NIL)
maplist keys               # Extract all keys → ( key1 key2 key3 )
maplist values             # Extract all values → ( val1 val2 val3 )
```

### Sorting (`mapsort`)

#### Overview

`mapsort` returns a new maplist sorted by keys, while keeping each `(key value)` pair intact. Pairs are the atomic unit; the original maplist is unchanged.

#### Stack effect

```
maplist  mapsort { kcmp }   ->  maplist'
```

#### Key comparator contract

- The block is called with `k1 k2`: `( k1 k2 -- r )`, same sign rules as `sort`.
- If keys are mixed/other types, supply a comparator.

#### Semantics

- Stable: pairs with equal keys keep original order.
- Pair-atomic: swaps move `(key value)` together; values may be compound.
- Sorted maps enable `bfind`: once sorted by the chosen key order, `bfind` can do binary search.

#### Complexity (informative)

- Time: O(n log n) comparisons.
- Space: O(n) (pair-wise builder with `cons` + `reverse`).

#### Examples

```tac
( `c @C  `a @A  `b @B )         mapsort
  \ -> ( `a @A  `b @B  `c @C )

( `f 2  `g 0  `h 1 )            mapsort {  \ numeric keys example
  - }                           \ -> ( `g 0  `h 1  `f 2 )

( `get @G  `default @D  `set @S )
  mapsort                       \ default is lexicographic on symbols
  \ -> ( `default @D  `get @G  `set @S )
```

> To “pin `default` to end,” define a comparator that returns positive when `k1` is ``default and `k2` is not.

#### Validation / errors

- Payload with odd slot count (not a proper pair sequence) → error/sentinel.
- Comparator not returning a number → error/sentinel.

<!-- Removed: Construction operations (assoc/dissoc/merge) to keep maplists focused on address-based access; build-new-structure APIs can live elsewhere. -->

### Stack Effects

**Retrieval**:
- `( maplist key — addr | default-addr | NIL )`
- `( maplist — keys )`
- `( maplist — values )`

<!-- Removed structural modifications stack effects -->

**Element mutations**:
- Prefer address-based updates via `find` + `store` from `lists.md`.

## 10. Integration with List Operations

Maplists are lists with conventions, so all list operations work:

```tacit
( `a 1 `b 2 `c 3 ) 1 element fetch → 1        # Access value element at index 1
( `a 1 `b 2 `c 3 ) elements        → 6        # Total elements (3 pairs × 2)
( `a 1 `b 2 `c 3 ) `b find fetch   → 2        # Access by key via address + fetch
10 ( `a 1 `b 2 `c 3 ) `b find store # In-place update if simple; else no-op
```

**Dual access patterns**: Address-based element access pairs with `fetch`/`store`; key-based access uses `find` to obtain an address.

**Mutation efficiency**: Simple values can be updated in-place via `store` without structural changes; compounds are no-op targets.

## 11. Performance Characteristics

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

## 13. Design Philosophy

**Simplicity**: Maplists require no new infrastructure - they're lists with search conventions.

**Flexibility**: Same underlying structure supports multiple access patterns (index-based and key-based).

**Performance transparency**: Linear search characteristics are explicit and predictable.

**Composability**: Maplists work seamlessly with all list operations while adding associative capabilities.

**Gradual optimization**: Start with simple linear search, upgrade to more sophisticated algorithms when datasets grow larger.

This approach aligns with TACIT's philosophy of building complex functionality from simple, composable primitives.

## 14. Implementation Examples

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

## 15. Related Specifications

- `docs/specs/lists.md` - Foundational list mechanics (required reading)
- `docs/specs/stack-operations.md` - Stack manipulation rules
- `docs/specs/tagged.md` - Type system and sentinel values (NIL)

---

## 16. Binary search (bfind)

### Overview

This is the maplist case of the unified `bfind` defined in Access. It locates a value in a sorted maplist by binary searching its keys. Pairs move as atomic units; only keys are inspected for order and equality.

### Preconditions

- The maplist is sorted by key with the same key comparator used by `mapsort`.

### Stack effect

```
maplist  key  bfind { kcmp }   ->  addr | nil
```

### Key comparator

- `kcmp ( key query -- r )` (or equivalently `( query key -- r )`) — must be consistent with `mapsort`.

### Semantics

- Binary search over key elements; moves `(key value)` pairs together.
- Returns the address of the matching value element, or `nil` if not found.

### Complexity (informative)

- Time: O(log n) comparisons
- Space: O(1)

### Notes

- Must use the same comparator as the sort; results undefined otherwise.
- With duplicate keys, return the first equal (lower_bound) for determinism.
- Errors: non-list or pair-misaligned payload → sentinel/error; comparator must return a number.

---

## 17. Appendix A: Advanced find

This appendix outlines optimized, address-returning search variants for maplists. All variants preserve the same interface shape and results as `find` but differ in preconditions and complexity. These are optional enhancements for larger datasets.

### bfind (binary search on sorted keys)

- Interface: `( sorted-maplist key — addr | default-addr | NIL )`
- Preconditions:
  - Keys are sorted by their numeric identity (for symbols, the interned digest index; for numeric keys, the integer value)
  - Even positions are keys (0,2,4,...) and odd positions are values (1,3,5,...)
- Behavior:
  - Performs binary search over key elements, comparing numeric identities without decoding strings
  - On match, returns the address of the corresponding value element
  - On miss, returns the `default` value address if present, otherwise NIL
- Complexity: O(log n)

### hfind (open-addressing hash index)

- Interface: `( maplist key — addr | default-addr | NIL )`, with an associated prebuilt hash index
- Preconditions:
  - A separate, contiguous hash index exists for the maplist, constructed from key/value pairs
  - Keys use their numeric identity (interned symbol index or integer) for hashing
- Behavior:
  - Computes a hash over the numeric identity, probes the index with open addressing (e.g., linear probing)
  - On hit, computes the value element address directly from a stored offset
  - On miss, falls back to `default` value address if present, else NIL
- Complexity: Average O(1) with appropriate load factor; O(k) with short probe sequences
- Notes:
  - The maplist remains immutable; the index must be rebuilt if a new maplist is created
  - Hashing leverages interned symbol indices to avoid runtime string hashing

These variants maintain the address-returning contract so they compose with `fetch`/`store` unchanged.
