# Tacit Local Variables and Function Stack Frame Specification


Try it (locals and increment)
```tacit
: demo
  5 var x
  2 +> x        \ same as: 2 x add -> x
  x
;
```

Try it (globals and bracket paths)
```tacit
( 1 2 3 ) global nums
9 -> nums[0]    \ nums becomes ( 9 2 3 )
nums
```

Orientation
- Start with core invariants: docs/specs/core-invariants.md
- Quick usage (locals and assignment):
  - `x` → VarRef + Load (value-by-default)
  - `&x` → VarRef + Fetch (slot ref)
  - Simple assignment: `42 -> x` or `&y -> x` (when y is simple)
  - Compound assignment: `(1 2 3) -> x` or `y -> x` (bare y compiles to Load)
  - Avoid `&y -> x` for compounds; use `&y load -> x` instead.
  - Increment: `value +> x` or `value +> x[ … ]` (locals-only; sugar for `value x add -> x` and `value x[ … ] add -> x[ … ]`)

Analogy — Refs as Symlinks
- Treat `&x` (refs to local slots) like filesystem symlinks rather than raw pointers:
  - Structure-aware ops (e.g., list `length`, `head`, `elem`) follow refs transparently, like syscalls following symlinks.
  - Stack ops (`dup`, `swap`, …) manipulate the ref value itself (no implicit deref).
  - `load` “follows the link” and yields the current value (materializes lists); `fetch` is a strict slot read.
  - Assignment materializes source refs before writing; compound writes require compatibility with the existing slot’s compound.

## Table of Contents

1. [Stack Architecture](#1-stack-architecture)
2. [Functions and Code Blocks](#2-functions-and-code-blocks)
3. [Function Stack Frame Layout](#3-function-stack-frame-layout)
4. [Local Variable Slots](#4-local-variable-slots)
5. [Variable Declaration and Compilation](#5-variable-declaration-and-compilation)
6. [Runtime Initialization](#6-runtime-initialization)
7. [Variable Access and Addressing](#7-variable-access-and-addressing)
8. [Compound Data Storage](#8-compound-data-storage)
9. [Function Entry and Exit](#9-function-entry-and-exit)
10. [Dictionary Management](#10-dictionary-management)
11. [New Opcodes](#11-new-opcodes)
12. [Code Block Behavior](#12-code-block-behavior)
13. [Variable Lifetime and Safety](#13-variable-lifetime-and-safety)
14. [Examples](#14-examples)
15. [Design Philosophy](#15-design-philosophy)
16. [Conclusion](#16-conclusion)

## 1. Stack Architecture

Tacit VM uses a dual-stack architecture. Both stacks share the same STACK segment:

- **Data Stack (SP)**: For computation and parameter passing (cell-indexed)
- **Return Stack (RSP)**: For function calls, local variables, and compound data storage (cell-indexed)

Local variables are stored in fixed-size slots on the return stack. The Base Pointer (BP) provides a stable reference point for addressing these slots within each function's frame.

## 2. Functions and Immediate Control Words

\**Functions*mul are declared using colon syntax:

```
: function-name ... ;
```

Conditionals are composed with immediate words that run during compilation:

```
flag if true-branch else false-branch ;
```

The branch bodies execute in the current function frame, so locals remain directly accessible.

## 3. Function Stack Frame Layout

When a function is called, the stack frame has the following structure:

```
[ return addr ]
[ previous BP ] ← BP (cells)
[ slot 0      ] ← BP + 0 (first local variable)
[ slot 1      ] ← BP + 1 (second local variable)
[ slot 2      ] ← BP + 2 (third local variable)
...
[ slot N-1    ] ← BP + (N-1) (last local variable)
[ compound    ] ← RSP grows upward (compound data storage)
[ data...     ]
```

The stack frame consists of:

1. **Standard frame header**: Return address and saved BP
2. **Local variable slots**: Fixed-size 32-bit slots for variable storage
3. **Compound data area**: Variable-size area for lists and complex structures

## 4. Local Variable Slots

Each local variable occupies exactly \**one 32-bit slot*mul that can contain:

- **Simple values**: Numbers, strings, symbols stored directly as tagged values
- **Compound references**: `Tag.RSTACK_REF` values pointing to compound data in the return stack

### Slot Storage Types:

- `Tag.NUMBER` - Direct numeric values
- `Tag.STRING` - String table references
- `Tag.CODE` - Code pointers
- `Tag.RSTACK_REF` - References to compound data on return stack
- `Tag.BUILTIN` - Builtin operation references

### Slot Capacity:

- \**Maximum 255 local variables*mul per function (8-bit slot count)
- \**Unlimited compound data*mul (grows dynamically on return stack)

## 5. Variable Declaration and Compilation

### Syntax

Variables are declared using:

```
value var name
```

The `value` is popped from the data stack at runtime and stored in the variable.

### Compilation Process

1. **Function Prologue**: Emit `RESERVE` with placeholder slot count
2. **Variable Registration**: Each `var` statement:
   - Registers symbol in compile-time dictionary
   - Assigns sequential slot number
   - Emits `INIT_VAR_SLOT` opcode
3. **Back-patching**: Update `RESERVE` with final slot count

### Example Compilation:

```tacit
: area var radius 3.142 var pi radius square pi mul ;
```

Generates bytecode:

```
CALL area-addr
RESERVE 2          ← back-patched from placeholder
INIT_VAR_SLOT 0    ← radius = TOS (runtime value)
LITERAL_NUMBER 3.142
INIT_VAR_SLOT 1    ← pi = 3.142
LOCAL_VAR_ADDR 0   ← push address of radius slot
FETCH              ← get radius value
SQUARE
LOCAL_VAR_ADDR 1   ← push address of pi slot
FETCH              ← get pi value
MUL
EXIT
```

## 6. Runtime Initialization

### Function Entry Sequence:

1. \**Standard frame setup*mul (handled by existing `callOp`):
   - Save return address: `rpush(IP)`
   - Save base pointer: `rpush(BP)`
   - Set new base pointer: `BP = RSP`

2. \**Slot allocation*mul (`RESERVE` opcode):
   - Read slot count from bytecode
   - Advance RSP: `RSP += slot_count` (cells)

3. \**Variable initialization*mul (`INIT_VAR_SLOT` opcodes):
   - Pop value from data stack
   - Store in designated slot with appropriate tagging

### Initialization Types:

**Simple Values**: `42 var x`

- Calculate slot address: `BP + slot` (cell index)
- Store value directly as tagged number in slot

**Compound Values**: `(1 2 3) var mylist`

- Calculate slot address: `BP + slot` (cell index)
- Store an `RSTACK_REF` pointing to the list header cell on RSTACK
- Copy entire compound structure to return stack above the slots

## 7. Variable Access and Addressing

### Access Forms

Variable access has two forms:

- **Value access**: `x` — pushes the actual value (simple or compound) onto the data stack
- **Reference access**: `&x` — pushes an RSTACK_REF to the variable slot for optimization

`x` returns the materialized value (via `load`). `&x` returns an `RSTACK_REF` for performance optimization; pair with `fetch` to read slot content or `load` to materialize.

### Compilation Sequences

**Target compilation**:
```
x        → VarRef + Load              (value-by-default)
&x       → VarRef + Fetch             (explicit reference)
x -> y   → VarRef + Store             (assignment, unchanged)
```

### Stack Effects (Target):

```
x           ( — value )       \ Direct value (simple or compound)
&x          ( — RSTACK_REF )  \ Reference to slot for optimization
value -> x  ( — )             \ Assignment (resolves source refs where applicable)
```

### Tagging & Resolution Notes

- Parser/symbol table uses `Tag.LOCAL` to identify local variables and emit `VarRef` + `Fetch/Store` during compilation.
- At runtime, local variable slots are addressed via `RSTACK_REF` (absolute cell index within the current return stack frame). `Tag.LOCAL` is not a runtime reference and should not appear on the data stack.

## 8. Compound Data Storage

Compound values (lists, maplists) are stored in the return stack area above the variable slots:

### Storage Strategy:

1. **Slot contains reference**: Store `Tag.RSTACK_REF` pointing to compound data
2. **Data copied to return stack**: Complete structure copied, not referenced
3. **Proper structure layout**: Maintains list format (payload + header)

### Example - List Storage:

```
: process-data (1 2 3) var mylist mylist fetch ;
```

Frame layout after initialization:

```
[ return addr ]
[ previous BP ] ← BP
[ slot 0: Tag.REF(RP_addr) ] ← mylist slot
[ list_data: 1 ]             ← RP_addr (compound data)
[ list_data: 2 ]
[ list_data: 3 ]
[ list_header: LIST:3 ]      ← RSP
```

## 9. Function Entry and Exit

### Function Entry:

1. Standard frame setup (existing `callOp`)
2. Execute `RESERVE N` - allocate N local variable slots
3. Execute `INIT_VAR_SLOT` operations - initialize each variable

### Function Exit:

1. **Single instruction cleanup**: `RSP = BP`
   - Deallocates all local variable slots
   - Deallocates all compound data
   - Handles nested structures automatically
2. Restore previous BP: `BP = rpop()`
3. Restore return address and jump: `IP = rpop()`

### Cleanup Elegance:

The `RSP = BP` operation instantly deallocates:

- All local variable slots
- All compound data structures
- All nested compound data
- Everything above the saved BP

No complex deallocation logic, reference counting, or memory management required.

## 10. Assignment Semantics

### Simple Values

Assignment to a local variable slot is direct:

```
100 -> x
```

This stores the value `100` in the slot for `x`. The value is tagged appropriately (e.g., `Tag.NUMBER`).

### Compound Values (Lists)

Assignment to a local variable slot containing a compound value (e.g., a list or maplist) is only allowed if the new value is **compatible**: it must have the same slot (cell) count and type as the existing value. The assignment copies the contents of the new value into the existing structure, element-wise, **without changing the slot reference**. If the slot count or type does not match, assignment is invalid and should raise an error.

```
(1 2 3) -> y   # allowed if y is a list of 4 cells (1 header + 3 payload)
(1 2)   -> y   # error if y is a list of 4 cells
maplist5 -> z  # allowed if z is a maplist of 5 cells
list4    -> z  # error if z is a maplist, even if slot count matches
```

### General Rule

Assignment never changes the slot reference for compound types—only the contents are updated.

## 10.2 Increment Operator (+>)

The increment operator provides concise syntax for in-place updates of local variables:

Syntax and desugaring
- Form: `value +> x`
- Desugars to: `value x add -> x`

- Bracket-path form: `value +> x[ … ]`
- Desugars to: `value x[ … ] add -> x[ … ]`

Stack effects (logical)
- `+>` operates as sugar over existing primitives; effect is equivalent to reading the current value (directly or via a bracket path), adding `value`, and writing back to the same destination.

Scope and constraints
- Locals-only destination: Only valid inside function definitions and only targets local variables (either the slot `x` or a bracket-path selection within `x`).
- Path rules: Bracket-path destinations follow the same validity and error semantics as `value -> x[ … ]` (e.g., invalid paths throw; type/shape checks apply for compound elements).
- Errors:
  - Using `+>` outside a function: “Increment operator (+>) only allowed inside function definitions”.
  - Undefined local name after `+>`: “Undefined local variable: <name>”.

Examples
```
: inc1
  0 var x
  1 +> x
  x
;

: inc-multi
  5 var x
  1 +> x
  2 +> x
  x
;

: inc-float
  1.5 var x
  -0.5 +> x
  x
;

: equivalence
  10 var x
  1 +> x          \ same as: 1 x add -> x
  x
;

: inc-bracket
  ( 10 20 ) var xs
  7 +> xs[0]       \ same as: 7 xs[0] add -> xs[0]
  xs
;

: inc-nested
  ( ( 1 2 ) ( 3 4 ) ) var xs
  1 +> xs[0 1]     \ increment nested element
  xs
;
```

Lowering details (for implementers)
- Simple form `value +> x` compiles to: `VarRef(slot)` → `Swap` → `Over` → `Fetch` → `Add` → `Swap` → `Store`.
- Bracket-path form `value +> x[ … ]` compiles the destination address like assignment, then performs RMW:
  - Address build: `VarRef(slot)` → `Fetch` → `[path]` → `Select` → `Nip`
  - RMW: `Swap` → `Over` → `Fetch` → `Add` → `Swap` → `Store`

## 10.1 In-Place Mutation of Locals (Normative)

- Destination locality: Local variables live in the return stack segment (SEG_RSTACK). Assignment mutates the destination in place in SEG_RSTACK. The destination is not copied/materialized to the data stack for modification.
- Simple locals: The slot at `BP + slot*4` is directly overwritten with the source value (after materializing the source if it is a ref).
- Compound locals: The slot contains an `RSTACK_REF` to the compound header stored above BP. On assignment with a compatible compound source, the payload cells at that address are overwritten from the source list on the data stack, then the header is written. The slot continues to point to the same header address.
- Alias preservation: `&x` continues to refer to the same region after assignment; assignment does not rebind the slot for compounds.
- Errors: Simple↔compound mismatches error; incompatible compound shapes (different type or slot count) error.

Implementation notes (for readers of the codebase)
- Parser: `x` compiles to `VarRef + Load`; `value -> x` compiles to `VarRef + Store`.
- Store path: `store` materializes source refs, resolves the destination ref, and for compound locals calls an in-place mutation that writes directly in SEG_RSTACK without advancing RSP.
For simple types, assignment replaces the value in the slot.

## 10. Dictionary Management

### Compile-Time Scope:

- `mark()` at function start (existing)
- Register each local variable: `define(name, LOCAL_VAR, slot_number)`
- `revert()` at function end (existing) - removes all local symbols

### Symbol Resolution Priority:

1. \**Local variables*mul (if inside function)
2. \**Global symbols*mul
3. **Built-in operations**

### Symbol Types:

| Symbol Kind | Purpose                | Data Stored      |
| ----------- | ---------------------- | ---------------- |
| BUILTIN     | Built-in operations    | Opcode number    |
| USER_DEF    | User-defined functions | Bytecode address |
| LOCAL_VAR   | Local variables        | Slot number      |

Local variables store slot numbers instead of opcodes or addresses.

## 11. New Opcodes

| Opcode         | Purpose                  | Encoding                     | Operation                           |
| -------------- | ------------------------ | ---------------------------- | ----------------------------------- |
| RESERVE        | Allocate local slots     | `RESERVE slot_count`         | Advance RSP by slot_count (cells)   |
| INIT_VAR_SLOT  | Initialize variable slot | `INIT_VAR_SLOT slot_number`  | Pop TOS, store in slot with tagging |
| LOCAL_VAR_ADDR | Push slot address        | `LOCAL_VAR_ADDR slot_number` | Push BP + slot_number (cells)       |

### RESERVE Details:

- **Limits**: slot_count is 8-bit (0-255 variables maximum)
- **Memory**: Allocates contiguous 32-bit slots on return stack
- **Timing**: Executed once per function call during prologue

### INIT_VAR_SLOT Details:

- **Simple values**: Store directly as tagged value in slot
- **Compound values**: Store Tag.REF pointing to return stack data
- **Data copying**: Compound structures copied to return stack above slots

### LOCAL_VAR_ADDR Details:

- **Address calculation**: BP + slot_number (cells). Multiply by `CELL_SIZE` only when passing the address to raw memory helpers.
- **Usage**: Combined with FETCH/STORE for variable access
- **Compile-time**: slot_number resolved from symbol table

### Back-Patching Support:

- RESERVE emitted with placeholder slot count during compilation
- Slot count incremented for each var declaration encountered
- Compiler back-patches final slot count using patch8 method

## 12. Immediate Conditionals and Locals

Immediate control flow executes inside the current function frame, so branch bodies can use local variables directly:

- **No new stack frame**: `if … else … ;` emits bytecode that reuses the caller's BP.
- **Direct access**: Locals such as `x` remain in scope for each branch.
- **Cleanup unchanged**: The surrounding function still unwinds the frame.

Example:

```
: conditional-math
    5 var x
    x 0 gt if x 2 mul else 0 ;
;
```

## 13. Variable Lifetime and Safety

### Structural Lifetime Enforcement:

- **Variables live**: From declaration until function return
- **Memory safety**: Automatic via stack discipline
- **Invalid references**: Impossible due to stack layout
- **No borrow checker needed**: Stack structure prevents illegal access

### Safety Guarantees:

- **Automatic deallocation**: `RSP = BP` cleanup
- **No memory leaks**: Stack-based allocation
- **No dangling pointers**: References can't outlive function
- **No fragmentation**: Contiguous stack allocation

### Illegal Operations:

- **Returning local references**: Stack addresses become invalid
- **Storing locals in globals**: Lifetime mismatch
- **Variable declarations outside colon definitions**: Compile-time error

## 14. Examples

### Basic Variable Declaration and Access:

```
: calculate
    10 var a
    5 var b
    a fetch b fetch add    \ Read both variables and add
;
```

### Compound Variable Storage:

```
: process-list
    (1 2 3) var mylist         \ Store list in variable (copied)
    mylist fetch               \ Get reference to list data
    length                     \ Get list length
;
```

### Formal Parameters via Variables:

```
: area ( radius -- area )
    var radius                 \ Capture parameter from stack
    3.14159 var pi            \ Local constant
    radius fetch               \ Get radius value
    dup mul                    \ radius²
    pi fetch mul               \ × π
;

\ Usage: 5 area  → 78.54
```

### Multiple Locals with Mixed Types:

```
: complex-calc
    var input                  \ Runtime value from stack
    (10 20 30) var coeffs     \ Compile-time list
    0 var result              \ Initialize to zero

    input fetch coeffs fetch head
    result fetch add result store
;
```

### Conditional Access to Locals:

```
: conditional-process
    var data
    data fetch 0 gt if data fetch 2 mul else 0 ;
;
```

## 15. Design Philosophy

### Slot-Based Architecture

Tacit treats local variables as fixed-size slots that can hold any tagged value. This uniform approach allows:

- **Predictable frame layout**: Compile-time slot allocation
- **Runtime type flexibility**: Slots adapt to actual data types
- **Efficient access**: Direct slot addressing
- **Clean separation**: Allocation vs initialization

### Copy Semantics for Compound Data

All variable assignment copies data rather than sharing references:

- **Ownership clarity**: Each variable owns its data
- **No aliasing issues**: Changes to one variable don't affect others
- **Predictable behavior**: Assignment always copies
- **Memory safety**: No shared mutable state

### Stack-Native Memory Management

Local variables use the return stack as a "local heap":

- **Automatic lifetime**: Variables live exactly as long as function
- **Zero-cost cleanup**: Single pointer assignment deallocates everything
- **No garbage collection**: Stack discipline handles all memory
- **C-port ready**: Direct translation to stack-based allocation

### Unified Tagged Value System

Local variables use the same tagged value system as the rest of Tacit:

- **No special types**: Variables store standard tagged values
- **Existing operations**: `fetch` and `store` work unchanged
- **Type safety**: Tags prevent interpretation errors
- **Consistent addressing**: Same memory model throughout

## 16. Conclusion

This specification establishes a complete local variable system for Tacit that separates compile-time allocation from runtime initialization. The slot-based architecture provides:

**Compile-Time Benefits**:

- Fixed frame layout with known slot count
- Symbol resolution through existing dictionary
- Back-patching for efficient code generation

**Runtime Benefits**:

- Type-flexible slots using tagged values
- Efficient compound data storage with copy semantics
- Automatic memory management via stack discipline
- Zero-overhead cleanup with single instruction

**Integration Benefits**:

- Builds on existing stack frame infrastructure
- Uses proven tagged value system
- Keeps immediate-word constructs (e.g., `if … ;`, `capsule … ;`) within the same lexical scope
- Supports both simple and compound data types

The design provides a foundation for sophisticated local variable usage while maintaining Tacit's stack-oriented philosophy and preparing for eventual C translation.
