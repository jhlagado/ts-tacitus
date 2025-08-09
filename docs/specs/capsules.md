Here’s the updated capsules.md applying the detailed edit plan from earlier, preserving all original information while expanding with additional details, context, and terminology consistency.


---

TACIT Capsules Specification

Introduction

TACIT capsules provide object-like encapsulation for structured data and behavior, while remaining fully compatible with TACIT’s stack-based execution model. Capsules are built directly on TACIT’s list infrastructure and leverage maplist-based method dispatch for efficiency. They combine a predictable, slot-indexed layout with stack-resident execution semantics, enabling compositional and efficient manipulation of structured state.

Key Principles

List-based foundation – Capsules are lists with a fixed and introspectable structure.

Copy-based instantiation – No inheritance chains, dynamic allocation, or garbage collection required.

No hidden closures – All state is stored explicitly as list slots; no lexical environment capture.

Stack-compatible – Capsules can be manipulated with standard TACIT list and stack operators without special handling.

Slot-addressable fields – Field offsets are computed at compile time for O(1) access.

Immutable structure, mutable fields – List length and layout are fixed post-construction; simple field values may be updated in place.



---

Basic Structure

Capsule Layout

A capsule is a list with the following structure:

( ( `name1 @method1 `name2 @method2 ... `nameN @methodN ) field1-value field2-value ... fieldN-value )

Element 0 (Slot 0) – Dispatch MapList: alternating method name symbols and code references.

Elements 1..N (Slots 1..) – Field values, which may be simple values (1 slot) or compound values (multi-slot).


Dispatch MapList format:

Even positions (0, 2, 4…): Method name symbols.

Odd positions (1, 3, 5…): Code references to methods.


Example in memory:

( ( `greet @greet-code `reset @reset-code `incrementViews @increment-code ) "John" "Doe" 0 )


---

Capsule Definition Syntax

Basic Example

capsule person
  "John" field firstName
  "Doe"  field lastName  
  0      field viewCount

  : greet firstName " " lastName concat concat "Hello, " swap concat ;
  : incrementViews viewCount 1 + -> viewCount ;
  : reset 0 -> viewCount ;
end

Syntax Elements

capsule <name> – Begin capsule definition.

<value> field <name> – Declare a field and initialize with value from the stack.

: <name> ... ; – Define a method body.

end – Finalize capsule, assemble prototype, install into dictionary.


Syntax Primitives Table

Syntax	Meaning

capsule <name>	Marks capsule start and stores name in dictionary.
<value> field <symbol>	Declares and initializes a field. Stored by slot offset.
: name ... ;	Defines method as standard TACIT word with field access.
end	Terminates capsule definition and assembles prototype.



---

Field Access

Reading Fields

Within methods, field names are compiled into direct slot fetches:

firstName    \ Returns field value

Writing Fields

Use the -> operator to store values into fields:

"Jane" -> firstName

Slot and Element Operations

Capsules also support explicit slot- and element-based addressing:

slots – Returns total number of slots in the capsule list.

elements – Returns logical element count.

slot ( num -- addr ) – Returns address of slot.

element ( num -- addr ) – Returns address of element.


These enable low-level access for tooling or meta-programming.

Variable System Integration

Future TACIT versions may integrate:

Global variables – Stored in global heap.

Local variables – Stored in return stack.

Field variables – Integrated into unified variable access model.



---

Method Dispatch via with

Basic Usage

person with {
    .getName "hello, " swap concat
    .setGreeting
    .greet
}

Principles:

with – Infix combinator taking a receiver and a block.

.method – Sigil for receiver-based method dispatch.

No copying – Receiver remains on stack.

Nested safe – Receiver is saved/restored for nested blocks.

Scope bounded – Block boundaries define lifetime.


Execution Steps

1. with sets receiver register from stack.


2. .method looks up in receiver’s MapList.


3. Upon block end, receiver is removed from stack.



Nested Example

person1 with {
    .greet
    person2 with {
        .greet
    }
    .incrementViews
}

Inter-Method Calls

capsule calculator
  0 field total
  : add total + -> total ;
  : addTwice .add .add ;
  : addDouble 2 * .add ;
end

Default Methods

MapList supports a default key for fallback dispatch.


---

Integration with TACIT Core

List Compatibility

Capsules are lists and work with all list operators:

capsule 2 get     \ Access field by slot index
capsule length    \ Total elements

Stack Operations

capsule dup
capsule swap

MapList Tools

Fully compatible with standard MapList search.

Supports introspection and default fallback.



---

Design Rationale

The with combinator solves:

1. Argument/receiver separation.


2. Explicit context clarity.


3. Multiple calls without dup proliferation.


4. Preserves TACIT’s compositional stack style.




---

Related Specs

lists.md

maplists.md

capsules-implementation.md



---

