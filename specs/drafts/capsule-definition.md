# Capsule Definition Specification

Capsules in TACIT are structured lists with symbolic field access and embedded methods. They are defined at compile time via a combination of dictionary tracking and post-definition synthesis.

## 1. `capsule <name>` — Start Capsule Definition

When the compiler encounters `capsule person`, it:

- **Marks the current dictionary position** as the start of the capsule definition.
- **Stores the capsule name** (`person`) in the compiler instance.
- **Enters capsule compilation mode**, where field and method definitions are collected.

No runtime data is emitted yet.

## 2. Field Definition

Inside a capsule definition, a field is declared via:

```tacit
field firstName
```

When the compiler processes this:

- It assigns the **next available slot offset** (starting from 1) for the field.
- Records this field name and its slot index in a field symbol table (used during method compilation).
- No code is emitted, but a **dictionary entry is created** that holds:
  - The symbol (`firstName`)
  - The initial value (if declared)
  - The assigned index

All field offsets must be assigned **at the time of declaration**, since methods that follow may reference them by name.

Fields declared *after* a method is compiled are **not visible** to that method. This gives Forth-style forward-only compilation semantics.

## 3. Method Definition

Methods are defined like colon definitions inside the capsule. For example:

```tacit
: fullName ( -- str ) firstName lastName join ;
```

While compiling this:

- The compiler resolves **field accesses** (like `firstName`, `lastName`) using the field symbol table.
- These symbols are replaced with **stack code that accesses `self` and loads from the known field offset**.
- The method is compiled into the code segment.
- A dictionary entry is created mapping the method name to the code reference.

The methods themselves are not stored in the capsule body — instead, they are installed into a **map list** in slot 0 during construction.

## 4. `end` — Finalize Capsule

At `end`, the compiler:

### 4.1. Walks the Dictionary Backward

From most recent entry to the capsule start marker, it:

- Collects **method entries** into a map list:
  - The map list alternates between symbol and code reference: `( 'fullName fullName-code ... )`
  - This list becomes **slot 0** of the capsule.

### 4.2. Walks the Dictionary Forward

From capsule start marker to `end`, it:

- Collects **initial field values** (in order of declaration).
- Evaluates or compiles these values to produce literals on the stack.
- Pushes these values onto the data stack after the map list.

### 4.3. Constructs the Capsule Prototype

- The stack now contains:
  - Slot 0: method map
  - Slots 1..n: field initial values
- The compiler emits a `LIST` tag (length = field count + 1).
- A `LINK` tag is added on top, allowing introspection from TOS.
- This entire list becomes the **capsule prototype**, stored under the name `person`.

## 5. Cleanup and Replacement

- All dictionary entries between `capsule person` and `end` are **forgotten**.
- The final prototype replaces them as a **single new dictionary entry**, named `person`.
- The compiler exits capsule compilation mode.

## 6. Result

At runtime, evaluating `person` pushes the entire prototype list onto the stack. It can be copied or modified, and supports symbolic dispatch using the method map in slot 0.

