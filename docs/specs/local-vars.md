# Tacit Local Variables and Function Stack Frame Specification

Orientation
- Start with core invariants: docs/specs/core-invariants.md
- Quick usage (locals and assignment):
  - `x` → VarRef + Load (value-by-default)
  - `&x` → VarRef + Fetch (slot ref)
  - Simple assignment: `42 -> x` or `&y -> x` (when y is simple)
  - Compound assignment: `(1 2 3) -> x` or `y -> x` (bare y compiles to Load)
  - Avoid `&y -> x` for compounds; use `&y load -> x` instead.

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

- **Data Stack (SP)**: For computation and parameter passing
- **Return Stack (RP)**: For function calls, local variables, and compound data storage

Local variables are stored in fixed-size slots on the return stack. The Base Pointer (BP) provides a stable reference point for addressing these slots within each function's frame.

## 2. Functions and Code Blocks

\**Functions*mul are declared using colon syntax:

```
: function-name ... ;
```

\**Code blocks*mul are sections of code enclosed in curly braces `{ ... }`:

```
if { condition } then { true-branch } else { false-branch } endif
```

Key difference: Functions create new stack frames with local variable slots, code blocks execute within their containing function's frame and access parent locals.

## 3. Function Stack Frame Layout

When a function is called, the stack frame has the following structure:

```
[ return addr ]
[ previous BP ] ← BP (points to saved base pointer)
[ slot 0      ] ← BP + 0 (first local variable)
[ slot 1      ] ← BP + 4 (second local variable)
[ slot 2      ] ← BP + 8 (third local variable)
...
[ slot N-1    ] ← BP + (N-1)*4 (last local variable)
[ compound    ] ← RP grows upward (compound data storage)
[ data...     ]
```

The stack frame consists of:

1. **Standard frame header**: Return address and saved BP
2. **Local variable slots**: Fixed-size 32-bit slots for variable storage
3. **Compound data area**: Variable-size area for lists and complex structures

## 4. Local Variable Slots

Each local variable occupies exactly \**one 32-bit slot*mul that can contain:

- **Simple values**: Numbers, strings, symbols stored directly as tagged values
- **Compound references**: `Tag.REF` values pointing to compound data in the return stack

### Slot Storage Types:

- `Tag.NUMBER` - Direct numeric values
- `Tag.STRING` - String table references
- `Tag.CODE` - Code pointers
- `Tag.REF` - References to compound data on return stack
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
   - Set new base pointer: `BP = RP`

2. \**Slot allocation*mul (`RESERVE` opcode):
   - Read slot count from bytecode
   - Advance RP: `RP += slot_count mul 4`

3. \**Variable initialization*mul (`INIT_VAR_SLOT` opcodes):
   - Pop value from data stack
   - Store in designated slot with appropriate tagging

### Initialization Types:

**Simple Values**: `42 var x`

- Calculate slot address: BP + slot × 4
- Store value directly as tagged number in slot

**Compound Values**: `(1 2 3) var mylist`

- Calculate slot address: BP + slot × 4
- Store Tag.REF pointing to current RP position
- Copy entire compound structure to return stack above RP

## 7. Variable Access and Addressing

### Access Forms (Target Model)

Variable access has two forms:

- **Value access**: `x` — pushes the actual value (simple or compound) onto the data stack
- **Reference access**: `&x` — pushes an RSTACK_REF to the variable slot for optimization

### Current vs Target Behavior

**Current (historical)**:
- Earlier builds returned references for some accesses and required an explicit resolve step. This has been replaced.

**Target (current)**:
- `x` always returns the materialized value (via `Load`).
- `&x` returns RSTACK_REF for performance optimization; pair with `fetch` to read slot content or `load` to materialize.

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

1. **Slot contains reference**: Store `Tag.REF` pointing to compound data
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
[ list_header: LIST:3 ]      ← RP
```

## 9. Function Entry and Exit

### Function Entry:

1. Standard frame setup (existing `callOp`)
2. Execute `RESERVE N` - allocate N local variable slots
3. Execute `INIT_VAR_SLOT` operations - initialize each variable

### Function Exit:

1. **Single instruction cleanup**: `RP = BP`
   - Deallocates all local variable slots
   - Deallocates all compound data
   - Handles nested structures automatically
2. Restore previous BP: `BP = rpop()`
3. Restore return address and jump: `IP = rpop()`

### Cleanup Elegance:

The `RP = BP` operation instantly deallocates:

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
| RESERVE        | Allocate local slots     | `RESERVE slot_count`         | Advance RP by slot_count × 4        |
| INIT_VAR_SLOT  | Initialize variable slot | `INIT_VAR_SLOT slot_number`  | Pop TOS, store in slot with tagging |
| LOCAL_VAR_ADDR | Push slot address        | `LOCAL_VAR_ADDR slot_number` | Push BP + slot_number × 4           |

### RESERVE Details:

- **Limits**: slot_count is 8-bit (0-255 variables maximum)
- **Memory**: Allocates contiguous 32-bit slots on return stack
- **Timing**: Executed once per function call during prologue

### INIT_VAR_SLOT Details:

- **Simple values**: Store directly as tagged value in slot
- **Compound values**: Store Tag.REF pointing to return stack data
- **Data copying**: Compound structures copied to return stack above slots

### LOCAL_VAR_ADDR Details:

- **Address calculation**: BP + slot_number × 4
- **Usage**: Combined with FETCH/STORE for variable access
- **Compile-time**: slot_number resolved from symbol table

### Back-Patching Support:

- RESERVE emitted with placeholder slot count during compilation
- Slot count incremented for each var declaration encountered
- Compiler back-patches final slot count using patch8 method

## 12. Code Block Behavior

Code blocks preserve lexical access to parent function's local variables:

- **No new stack frame**: Execute in parent's frame
- **Access parent locals**: Use same `LOCAL_VAR_ADDR` opcodes
- **No cleanup required**: Parent function handles all cleanup

Example:

```
: conditional-math
    5 var x
    if { x 0 gt } then { x 2 mul } else { 0 } endif
;
```

The code blocks access the parent function's local variable `x` using the existing meta-bit system for lexical scoping. Note: `x` produces the value directly; use `&x fetch` if an address-based read is required.

## 13. Variable Lifetime and Safety

### Structural Lifetime Enforcement:

- **Variables live**: From declaration until function return
- **Memory safety**: Automatic via stack discipline
- **Invalid references**: Impossible due to stack layout
- **No borrow checker needed**: Stack structure prevents illegal access

### Safety Guarantees:

- **Automatic deallocation**: `RP = BP` cleanup
- **No memory leaks**: Stack-based allocation
- **No dangling pointers**: References can't outlive function
- **No fragmentation**: Contiguous stack allocation

### Illegal Operations:

- **Returning local references**: Stack addresses become invalid
- **Storing locals in globals**: Lifetime mismatch
- **Variable declarations in code blocks**: Compile-time error

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

### Code Blocks Accessing Locals:

```
: conditional-process
    var data
    data fetch 0 gt
    if { data fetch 2 mul }
    else { 0 }
    endif
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
- Maintains code block lexical scoping
- Supports both simple and compound data types

The design provides a foundation for sophisticated local variable usage while maintaining Tacit's stack-oriented philosophy and preparing for eventual C translation.
