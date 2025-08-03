# TACIT Capsules Overview

## Introduction

TACIT capsules provide object-like encapsulation for structured data and behavior while remaining fully compatible with TACIT's stack-based architecture. They are built on the list infrastructure and use maplist-based method dispatch.

### Key Principles
- **List-based**: Capsules are lists with a specific structure
- **Copy-based instantiation**: No inheritance chains or dynamic allocation
- **Closure-free**: All state explicitly stored, no lexical environments
- **Stack-compatible**: Work with standard TACIT stack operations

## Basic Structure

### Capsule Layout
A capsule is a list with this exact structure:
```tacit
( ( `name1 @method1 `name2 @method2 ... `nameN @methodN ) field1-value field2-value ... fieldN-value )
```

- **Element 0**: Maplist containing alternating method names and code references
- **Elements 1..N**: Field values (simple or compound values)

The dispatch maplist in element 0 follows standard maplist format:
- Even positions (0, 2, 4...): Method name symbols (e.g., `greet`, `reset`)  
- Odd positions (1, 3, 5...): Code references to method implementations (e.g., @greet-code)

Example in memory:
```tacit
( ( `greet @greet-code `reset @reset-code `incrementViews @increment-code ) "John" "Doe" 0 )
```

## Definition Syntax

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

## Field Access

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

## Method Dispatch with `with` Combinator

### Basic Usage
```tacit
person with {
    .getName "hello, " swap concat    \ Returns "hello, John Doe"
    .setGreeting                      \ Set internal greeting state
    .greet                           \ Print greeting
}
```

**Key Design Principles:**
- **`with` is a combinator** - takes receiver and block, manages `self` context
- **No copying** - receiver remains on stack, accessed via `self` register
- **`.method` is a prefix sigil** - reads method name, dispatches via `self`
- **Nested contexts** - `self` saved/restored for nesting
- **Block scoping** - explicit `{` `}` boundaries

### Implementation Mechanics

1. **`with` setup**: Set `self` register to point to receiver
2. **`.method` dispatch**: Look up method symbol in `self`'s maplist (element 0) and execute
3. **`with` cleanup**: Restore previous `self` value and consume receiver

### With Arguments
```tacit
person with {
    "Dr." .setTitle               \ Pass argument to method
    .getName "Hello, " swap concat \ Use updated title
}
```

### Nested `with` Blocks
```tacit
person1 with {
    .greet
    person2 with {
        .greet
    }
    .incrementViews
}
```

### Inter-Method Calls
Methods can call other methods on the same receiver:
```tacit
capsule calculator
  0 field total
  
  : add total + -> total ;
  : addTwice .add .add ;           \ Calls add twice on same receiver  
  : addDouble 2 * .add ;           \ Double then add
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
instance with {
    .getValue     \ Returns 42
    .unknown      \ Returns "Unknown method" (fallback)
}
```

## Integration with TACIT

### List Compatibility
Capsules support all list operations:
```tacit
capsule 2 get        \ Access field by index
capsule length       \ Get total elements
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

## Design Rationale

The `with` mechanism solves fundamental stack-based OOP problems:

1. **Argument Separation** - Method args don't interfere with receiver
2. **Context Clarity** - Explicit scope for method dispatch  
3. **Ergonomics** - Natural multiple method calls
4. **Stack Hygiene** - No `dup` proliferation

This maintains TACIT's stack-based nature while providing object-oriented convenience.

## Related Specifications

- `docs/specs/lists.md` - Foundational list mechanics
- `docs/specs/maplists.md` - Key-value dispatch tables  
- `docs/specs/capsules-implementation.md` - Detailed implementation guide
