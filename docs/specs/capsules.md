# TACIT Capsules Specification

## 1. Introduction

TACIT capsules provide object-like encapsulation for structured data and behavior while remaining fully compatible with TACIT's stack-based architecture. They are built on the list infrastructure and use maplist-based method dispatch.

### Key Principles
- **List-based**: Capsules are lists with a specific structure
- **Copy-based instantiation**: No inheritance chains or dynamic allocation
- **Closure-free**: All state explicitly stored, no lexical environments
- **Stack-compatible**: Work with standard TACIT stack operations

## 2. Basic Structure

### Capsule Layout
A capsule is a list with this exact structure:
```tacit
( ( `name1 @method1 `name2 @method2 ... `nameN @methodN ) field1-value field2-value ... fieldN-value )
```

- **Slot 0**: Maplist containing alternating method names and code references
- **Slots 1..N**: Field values (scalars or compound values)

The dispatch maplist in slot 0 follows standard maplist format:
- Even positions (0, 2, 4...): Method name symbols (e.g., `greet`, `reset`)  
- Odd positions (1, 3, 5...): Code references to method implementations (e.g., @greet-code)

Example in memory:
```tacit
( ( `greet @greet-code `reset @reset-code `incrementViews @increment-code ) "John" "Doe" 0 )
```

## 3. Definition Syntax

### Basic Capsule Definition
```tacit
capsule person
  "John" field firstName
  "Doe"  field lastName  
  0      field viewCount

  : greet firstName " " lastName concat concat "Hello, " swap concat ;
  : incrementViews viewCount 1 + -> viewCount ;
  : reset 0 -> viewCount ;
end
```

### Syntax Elements
- `capsule <name>` - Begin capsule definition
- `<value> field <name>` - Declare field with initial value
- `: <name> <body> ;` - Define method
- `end` - Complete capsule definition

### Syntax Primitives Table

| Syntax                   | Meaning                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------- |
| `capsule <name>`         | Begin capsule definition scope. Marks dictionary position and stores name.       |
| `<value> field <symbol>` | Declare field with initial value from stack. Stored by offset in capsule.      |
| `: name ... ;`           | Define method as conventional TACIT function with field access.               |
| `end`                    | Terminates capsule. Triggers collection, prototype assembly, and installation. |

### Declaration Rules and Ordering

- **Field declarations must precede method declarations** if methods reference those fields
- Field names are **relative to `self`** and valid only within capsule scope  
- Field declarations shadow global names using standard Forth dictionary behavior
- Methods may access fields directly (symbolic name) or indirectly (via dispatch)
- All methods compiled with visibility into current capsule's fields at compilation time
- Forward references to fields not yet declared will cause compilation errors

## 4. Field Access

### Field Declaration Semantics
The `field` keyword does not allocate a global variable. Instead, it:
- Pops a value (scalar or list) from the stack
- Writes it temporarily into the dictionary entry (not the capsule yet)
- Associates the name with an **offset** stored in compiler environment
- Allows symbolic references to be resolved during method compilation

Each field becomes a **slot** in the prototype list, with offset starting at 1 (slot 0 reserved for dispatch maplist).

### Reading Fields
Within methods, field names directly return values:
```tacit
firstName    \ Returns field value
```

### Writing Fields  
Use the `->` operator for assignment:
```tacit
"Jane" -> firstName    \ Updates field value
```

### Compilation Details
Field access compiles to fixed offsets:
```tacit
firstName           \ Compiles to: self 1 get
lastName            \ Compiles to: self 2 get
100 -> viewCount    \ Compiles to: 100 self 3 set
```

### Field Value Storage
- Field values stored during `end` processing by reading dictionary
- Compiler walks dictionary to collect all `field` entries  
- Emits stored values to data stack in offset order
- Only scalars and tagged LIST objects allowed as field values
- Each list must be properly tagged with inline length and backlink

## 5. Method Dispatch - The Problem

### Traditional Stack-Based Approach (Problematic)
```tacit
person new
dup `greet dispatch      \ Returns "Hello, John Doe"  
dup `incrementViews dispatch
dup `viewCount dispatch  \ Returns 1
```

**Problems:**
- Stack pollution with `dup` calls
- Method arguments interfere with receiver object
- Verbose and error-prone for multiple calls
- Poor ergonomics for method chaining

## 6. Method Dispatch - The Solution

### `with` Block Context
```tacit
person new with
  $greet                 \ Returns "Hello, John Doe"
  $incrementViews
  $viewCount             \ Returns 1
end
```

**Benefits:**
- Clean method chaining without `dup`
- Arguments separated from receiver object  
- Concise `$` prefix syntax
- Explicit scope boundaries

### With Arguments
```tacit
person new with
  "Dr." $setTitle        \ Pass argument to method
  $greet                 \ Returns "Hello, Dr. John Doe"
end
```

## 7. Implementation Details

### `with` Block Behavior
1. `with` saves receiver object in context register
2. `$method` expands to `context `method dispatch`
3. Method arguments consumed normally from stack
4. `end` clears context register
5. Receiver remains on stack after block

### Alternative Syntax
Both forms work within `with` blocks:
```tacit
person new with
  $greet                 \ Shorthand
  `incrementViews dispatch   \ Explicit
end
```

### Field Visibility Rules
- Fields must be declared before methods that reference them
- Methods can only access fields declared earlier in the definition  
- Methods compiled before a field is declared will not have access to it
- This enforces one-pass, forward-declaration rule consistent with Forth tradition
- Forward references require symbolic dispatch

### Structural vs Element Mutability
Following list mutability semantics:
- **Fields can be mutated** using `->` operator (efficient, O(1))
- **Structure is immutable** - adding/removing fields requires new capsule
- **Compound field values** follow their own mutability rules  
- **No in-place modification** of capsule structure itself

## 8. Advanced Features

### Method Chaining with Arguments
```tacit
person with
  "Dr." $setTitle
  "Smith" $setLastName
  $incrementViews  
  $greet                 \ Returns "Hello, Dr. Smith"
end
```

### Inter-Method Calls
Methods can call other methods:
```tacit
capsule calculator
  0 field total
  
  : add total + -> total ;
  : addTwice dup self swap $add self swap $add ;
  : addDouble 2 * self swap $add ;
end
```

### Nested `with` Blocks
```tacit
person1 with
  $greet
  person2 with
    $greet
  end
  $incrementViews
end
```

### Default Method Support
Following maplist conventions:
```tacit
capsule example
  42 field value
  
  : getValue value ;
  : default "Unknown method" ;
end

\ Usage
instance with
  $getValue     \ Returns 42
  $unknown      \ Returns "Unknown method" (fallback)
end
```

## 9. Compilation Process

The compiler processes capsule definitions in phases:

### Phase 1: Declaration Collection
When `capsule <name>` is encountered:
1. Mark current dictionary position as marker
2. Enter capsule compilation mode  
3. Record capsule name in compilation context
4. Collect field and method definitions in forward order

### Phase 2: Field Processing  
Each `field` declaration:
1. Assigns sequential slot offset (starting at 1)
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
3. Collect field values in declaration order (slots 1..N)
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
- Offsets start at 1 (slot 0 reserved for dispatch maplist)
- Each `field` increments internal counter
- Offset stored in dictionary entry under field name
- Used during method compilation for symbol resolution

#### Stack Semantics for Fields
- `field` pops value from stack, stores in dictionary temporarily
- Field values emitted to data stack in offset order during `end`
- Only scalars and tagged LIST objects allowed as field values

#### Symbol Resolution in Methods
- During method compilation, determine if symbol is field (relative) or global (absolute)
- Field references compile to: `self <offset> get` 
- Field assignments compile to: `<value> self <offset> set`
- Forward references to fields not yet declared cause compilation error

## 10. Performance Characteristics

### Field Access
- **Read**: O(1) with compile-time offset resolution
- **Write**: O(1) direct slot assignment

### Method Dispatch
- **Search**: O(n/2) linear search through maplist
- **Optimization**: Can use sorted maplists or hash-based dispatch

### Instantiation
- **Copy**: O(n) where n is number of fields
- **Allocation**: Direct stack copying, no heap overhead

## 11. Integration with TACIT

### List Compatibility
Capsules support all list operations:
```tacit
capsule 2 get        \ Access field by index
capsule length       \ Get total slots
```

### Stack Operations  
Standard stack manipulation works:
```tacit
capsule dup          \ Duplicate capsule
capsule swap         \ Standard stack ops
```

### Maplist Integration
- Support `default` key for fallback methods
- Compatible with maplist search algorithms
- Can use maplist introspection tools

## 12. Implementation Strategy

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

### Phase 3: `$` Syntax Sugar
Add shorthand method calls:
```tacit
instance with
  $method
end
```

## 13. Design Rationale

The `with` mechanism solves fundamental stack-based OOP problems:

1. **Argument Separation** - Method args don't interfere with receiver
2. **Context Clarity** - Explicit scope for method dispatch  
3. **Ergonomics** - Natural multiple method calls
4. **Stack Hygiene** - No `dup` proliferation

This maintains TACIT's stack-based nature while providing object-oriented convenience.

## Related Specifications

- `docs/specs/lists.md` - Foundational list mechanics
- `docs/specs/maplists.md` - Key-value dispatch tables  
- `docs/specs/stack-operations.md` - Stack manipulation rules
