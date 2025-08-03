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
( dispatch-maplist field1-value field2-value ... fieldN-value )
```

- **Slot 0**: Maplist containing method names and code references
- **Slots 1..N**: Field values (scalars or compound values)

Example in memory:
```tacit
( ( `greet @greet-code `reset @reset-code ) "John" "Doe" 0 )
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

## 4. Field Access

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

### Compilation
Field access compiles to fixed offsets:
```tacit
firstName    \ Compiles to: self 1 get
lastName     \ Compiles to: self 2 get
100 -> viewCount    \ Compiles to: 100 self 3 set
```

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

### Phase 1: Collection
- Mark dictionary position at `capsule`
- Collect field and method definitions
- Assign field offsets (starting at 1)

### Phase 2: Method Compilation  
- Compile methods as standard TACIT functions
- Resolve field references to fixed offsets
- Create code references for dispatch table

### Phase 3: Prototype Assembly
- Build dispatch maplist from methods
- Construct prototype list with fields
- Replace dictionary entries with single capsule definition

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
