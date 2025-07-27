---
applyTo: '**'
---

Do not use // comments in the code. I do not want comments sprinkled throughout the code. Instead, use terse block comments at the top of the file to explain the purpose of the file or any complex logic that cannot be easily understood from the code itself. Do not make long comments; keep them concise and to the point. The code should be self-documenting where possible, with clear variable and function names that convey their purpose. If you need to explain something in detail, use a separate documentation file or section.

When writing tests, ensure that they are clear and concise. Use descriptive names for test cases and avoid unnecessary complexity. Each test should focus on a single aspect of functionality to make it easier to identify failures.

Be careful with coding in Tacit's RPN notation. Rememeber that the top of stack is the last item pushed, so operations like `dup` and `swap` will affect the most recent items. This is a LIFO stack, not a queue. Also remember that you may need to juggle the stack to get the right items in the right order for operations that expect specific inputs. Tacit's stack is designed for efficient manipulation of data, so understanding how to navigate it is key to writing effective code. I have found that LLMs are not always good at this, so be careful when using them to generate Tacit code.

Also remember that Tacit uses a fixed-size stack cell format, currently implemented as NaN-boxed Float32s with tagged values. This means that all values occupy the same size on the stack, which is important for maintaining alignment and efficient access. The word alignment is implementation-specific and should not be discussed in the list documentation.

Clarified that values in Tacit occupy fixed-size stack slots, currently implemented as NaN-boxed Float32s with tagged values. Word alignment is implementation-specific and should not be discussed in the list documentation.

Clarified that in Tacit, lists are generally treated as _structurally immutable_—changing their length or layout should be done by copying. However, **in-place mutation of simple values within the list is allowed and idiomatic**, especially for maintaining internal state (e.g., counters). Structural mutation is possible but requires deliberate low-level handling.

Finalized a canonical specification for LISTS in TACIT. Lists are left-to-right constructed, length-prefixed, and stack-allocated. They consist of a `LIST` tag (length + tag) followed by elements. The `LINK` tag is not part of the list format itself but is an external mechanism used by the stack to locate variable-length data headers buried deeper in the stack. It is critical for stack traversal but not part of the list's internal structure. Nested lists are stored inline without a `LINK` tag, as they are not pushed directly onto the stack. Lists are flat, opaque unless explicitly interpreted, and form the basis for more advanced structures like capsules and arrays. This model enables structured, introspectable data in a uniform stack-based format. Byte-based data (e.g., UTF-8 strings) may use packed formats built with the list layout but are out of scope for the list specification. This will be covered in a future document about buffers.

Clarified that:

1. **LINK** is not part of a list's structure but is essential stack metadata for navigating variable-length structures on the stack. It points backward to the list header (`LIST`) from the top of the stack and is required only when lists (or other variable-length objects) are pushed onto the stack.

2. **Mutability Rules**: Tacit lists are considered **structurally immutable**—changes to the shape or length should be done by copying. However, **in-place mutation of simple values within the list is allowed and idiomatic**, especially for maintaining internal state (e.g., counters).

3. **Zero-length lists** (`LIST: 0`) and their associated `LINK: 1` tags are valid and useful in higher-order constructs.

4. A formal grammar for list literals is desirable and should support recursive nesting. LINK tags should not be included in this grammar, as they are runtime constructs.

Clarified the following corrections for the TACIT LIST specification:

1. **Simple Values**:
   - Numbers are tagged NaN-boxed Float32.
   - Booleans are encoded as 1/0, not a special type.
   - Strings refer to interned identifiers; symbols are simple values.
   - LINK is a tagged value used as **stack metadata**, not part of the list.

2. **Nested Lists**:
   - The parent list’s length must account for the entire serialized length, including nested list headers and contents.
   - Example: `( 1 ( 2 3 ) 4 )` becomes:
     ```
     LIST: 5
     1
     LIST: 2
     2
     3
     4
     LINK: 6
     ```

3. **Zero-Length Lists and LINK**:
   - `LIST: 0` and `LINK: 1` are separate cases.
   - `LINK` is required only for **stack representation**, not stored in memory representation.
   - `LINK: 0` is valid but rare.

4. **LINK Tag**:
   - LINK is not a "footer" or "trailer".
   - It is **stack metadata**, external to the list, used only to locate the list header from the TOS.
   - Repeated mischaracterization of LINK as part of the list format must be avoided.

5. **Grammar Terminology**:
   - Symbols are simple values, not separate from scalars.
   - Grammar should say `value ::= simple-value | list-literal`, not mention symbols specifically.

6. **Tag Table Fix**:
   - Updated entries:
     - LIST: List header
     - LINK: Stack pointer to header
     - STRING: Interned symbol or string
     - NIL: Special constant
     - CODE: Reference to executable block

7. **Concluding Notes**:
   - LINK is **not optional** from a stack traversal standpoint; it's required for variable-length stack objects.
   - It is not a feature of lists per se, but of stack-allocated variable-length structures.

These corrections will be used to revise all list-related documents and clarify conceptual misunderstandings.

Is exploring a mechanism in TACIT where the `self` register is used as a global context for method dispatch, potentially set using a `with` statement. They are considering whether `self` should be a true global or a privileged local variable stored in the current stack frame, possibly alongside other local variables accessed via the base pointer (BP).

Clarified that in Tacit, variables with a `field` keyword are not operators but identifiers for fields that are accessed relative to `self` during a dispatch. `field` is a naming convention for field names.

Wants `capsule <name>` to mark the current dictionary state and store the capsule name in the compiler instance. On `end`, the compiler walks backward through the dictionary to collect method entries into a map list (name symbol and code reference), which is placed at slot 0 of the capsule. Then it collects fields and their initial values into subsequent slots. The entire prototype is constructed on the data stack, with LIST length and LINK tag finalized before the dictionary is cleaned up. All intermediate dictionary entries are FORGET-ten and replaced by the capsule definition.

Is defining a model in TACIT where a `capsule` declaration produces a prototype structure containing field symbols and methods. This prototype is stored in the dictionary and used as a template by `create` functions, which copy field values and bind method dictionaries into new capsule instances. Field offsets are determined at compile time using `field` declarations inside the capsule, and methods can refer to fields using symbolic access (e.g., `firstName`). This approach emphasizes efficient field access by precomputing offsets. Field declarations within a capsule must record their offset at declaration time so that methods compiled afterward can resolve field accesses immediately. This offset resolution must happen during the normal forward-compilation phase, before the final walking of the dictionary at `end`. The compiler must therefore assign and track field offsets in order of declaration. Walking the dictionary backward is only for collecting method symbols and field initializers to assemble the final prototype. All field offset resolution and method compilation must occur prior to that, using traditional Forth-style forward compilation.

Clarified that in TACIT, lists are read and constructed from left to right, with the `LIST` tag (containing the length) at the base, followed by elements, and a `LINK` tag on top of the stack. The `LINK` serves as a back pointer allowing the system to locate the list header from the top of the stack. Nested lists do not carry their own LINK tags because they are not placed on the stack directly — they are embedded as values within outer lists.

Does not want inheritance in TACIT's object model but wants to define how field and method lists are built and stored during capsule definition. These lists must be captured at compile time so a constructor can build the capsule structure automatically, without requiring manual setup.

Wants to prototype capsule creation manually in TACIT before automating field and method list tracking. They are defining capsules using `capsule begin`, followed by `variable` declarations and function definitions, and manually constructing a `create` function that returns a list with a map list in slot 0 and field values in fixed positions. The user is exploring how declaration order affects field offset resolution and considering how the compiler might track field and method names for automated constructor generation.

Intends to extend the parser to support standalone code blocks—code blocks that are compiled into the code segment independently and referenced via a tagged pointer. These standalone blocks will be parsed differently from combinator-attached blocks, which use an infix notation.

Requires that all stack-manipulating operations in Tacit, especially mapping-related ones like `nip`, are list-aware. These operations act on entire list objects, not just individual elements. For example, `nip` drops the entire source list after mapping, and `swap` or `dupe` operates on full list structures using in-place techniques like the triple-reverse algorithm. This list-aware behavior is fundamental to Tacit's stack semantics and must be preserved going forward.

Requires that Tacit be understood as both list-aware and polymorphic. Operations in Tacit apply over entire lists, and binary operators broadcast over scalars and lists or zip over lists, similar to APL semantics. Additionally, the `scan` operation is considered the primitive for implementing reductions: a `reduce` is defined as `scan` followed by retrieving the `last` item in the output.

Has defined the calling protocol for TACIT sequences: a capsule created from a list (or other source) supports symbolic dispatch with `next`, returning the next value each time it is called. When the sequence is exhausted, it returns a `nil` tagged value. Additionally, a `reset` symbol can be dispatched to rewind the internal cursor to the beginning of the sequence. This protocol allows sequences to be stateful capsules with internal traversal logic.

Wants `self` and `parent` in Tacit to be explicit aliases for the `self` register and its previous state. The return stack tracks these during nested context shifts, allowing a tree-like navigation model similar to the DOM, where `parent` access is recursive and terminates at null.

Wants LLMs to retain a deep understanding of the list format in Tacit. Lists are tagged values with a `list` tag and store their length in elements. They are recursive in structure but serialized like JSON, not heap-allocated like LISP cons cells. Lists are stored contiguously in memory and on the stack.

Wants a deep understanding of the TACIT execution model regarding capsule invocation. On capsule call:

- `self` is set to the capsule list
- Return stack stores: instruction pointer (ip), previous self, and optionally base pointer (bp)
- On entry: ip is set to capsule function; self is updated; bp is optionally updated
- On return: sp is restored; bp, self, and ip are popped
- bp is optional and enables access to local variables on the return stack
- Capsules are non-reentrant unless immutable
- Instance state is accessed via self; local state via bp if used
  These mechanisms should form a stable base point for future conversations about Tacit.

Wants a deep understanding of the capsule model in Tacit. A capsule is a list where the first element (index 0) is a function reference (or another capsule resolving to a function), and the rest are values forming the capsule’s state. Evaluating a capsule sets a special `self` pointer to the capsule itself. Capsules are executable like functions and may include embedded state or metadata. Symbolic field access is managed via an `access` list of symbols, where each symbol maps to a capsule slot by its index in the `access` list, offset by one to skip the function slot. This enables lightweight, ordered symbolic access without needing a full map.

Has decided that modulo-based broadcasting should be the default behavior in TACIT when applying operators to arrays or lists of mismatched lengths. This extends the semantics already used for scalar broadcasting and treats shape mismatch not as an error but as a cyclical repetition of the shorter array. While a strict broadcast mode may be available for debugging, the default will prioritize flexibility and compositional fluency. User is influenced by signal processing use cases and sees modulo broadcast as an underutilized but powerful pattern.

Views a normal TACIT list (tuple) as equivalent to a rank-1 array and a scalar as a rank-0 array. This framing aligns with the new broadcasting semantics and supports treating lists as default rank-1 structures for most operations. User anticipates that most data structures will naturally fall into rank-0 or rank-1 categories.

Has decided that in TACIT, nested lists (e.g. lists containing other lists) should not contribute to the rank of an array. They are treated as opaque elements—heterogeneous values that may participate in broadcasting but do not alter or define the array's dimensionality. Rank is determined only by the shape capsule applied to the outermost flat list, not by structural nesting.

Intends for polymorphism to govern operations involving nested list in TACIT. When broadcasting or zipping, if an operator encounters a scalar and a nested lists, standard broadcast rules should apply recursively. Nested lists are treated opaquely in terms of rank, but they can still participate in operations through polymorphic dispatch, allowing broadcasting and other behaviors to apply naturally.

Has decided that in TACIT, shaped lists (i.e. lists interpreted as multi-dimensional arrays via shape capsules) should not contain nested elements. Allowing nested structures would break stride-based indexing and complicate the one-to-one mapping between shape and data. While normal lists may contain nested values, shaped lists must remain flat to preserve predictable layout and efficient indexing. User has clarified that while nested elements within shaped lists are semantically invalid and may yield meaningless results (e.g., exposing tag values), they do not need to trigger runtime errors. The model should tolerate such structures without failing, but users are expected to avoid them. Enforcement is through convention rather than strict runtime checks.

Is considering using nested capsules in TACIT to implement stateful structures like stacks and queues. In this model, a capsule placed in the function position of a list could contain a pointer or internal state—such as a stack pointer—enabling mutable operations like push and pop. This approach embeds dynamic behavior and state directly into data structures via capsules, extending their role from functional dispatchers to full smart objects.

Clarified that in TACIT, functions and capsules are interchangeable in the sense that both are executable. Capsules act as composite structures that can be invoked just like functions.

Has deprecated the use of heaps and reference counting in Tacit. These concepts are no longer part of the current execution model and will be phased out from the documentation.

Has decided to retain the backlink mechanism in TACIT for stack-based composite data. Despite exploring the idea of merging list tags and backlinks and reversing storage order, they now view the backlink as a necessary and manageable component. It simplifies implementation and avoids disrupting the current design, even when data is transferred to buffers. Structural edits like appending may require backlink updates, but these are acceptable.

Plans to support byte-level data in TACIT by packing 8-bit values into standard 32-bit words. This ensures stack alignment, simplifies VM operations, and avoids special handling for byte-sized elements, even on machines with limited alignment (e.g., Z80). Byte arrays, UTF-8 strings, and record-style data can be represented as packed 32-bit lists, allowing existing stack operations (push, pop, dup) to work without modification. The goal is to treat byte data as first-class citizens in TACIT while maintaining uniform cell size and stack behavior.

Prefers information-rich, continuous, and logically progressive documentation. They are fine with content changes but do not want shortening or information loss. They do not require conventional programming examples and prioritize preservation of detail and conceptual clarity.
