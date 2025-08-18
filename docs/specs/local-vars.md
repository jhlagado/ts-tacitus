# TACIT Local Variables and Function Stack Frame Specification

## Table of Contents

1. [Stack Architecture](#1-stack-architecture)
2. [Functions and Code Blocks](#2-functions-and-code-blocks)
3. [Function Stack Frame](#3-function-stack-frame)
4. [Local Variable Declaration](#4-local-variable-declaration)
5. [Variable Access and Addressing](#5-variable-access-and-addressing)
6. [Code Block Behavior](#6-code-block-behavior)
7. [Function Entry and Exit](#7-function-entry-and-exit)
8. [Dictionary Management](#8-dictionary-management)
9. [Variable Lifetime and Safety](#9-variable-lifetime-and-safety)
10. [Stack Register Summary](#10-stack-register-summary)
11. [Examples](#11-examples)
12. [Conclusion](#12-conclusion)

## 1. Stack Architecture

TACIT VM uses a dual-stack architecture similar to Forth. Both stacks share the same STACK segment:

- **Data Stack (SP)**: For computation and parameter passing
- **Return Stack (RP)**: For function calls and local variables

Local variables live on the return stack. The Base Pointer (BP) provides a stable reference point for addressing these variables within each function's frame.

## 2. Functions and Code Blocks

**Functions** are declared in Forth style:
```
: function-name ... ;
```

**Code blocks** are sections of code enclosed in curly braces `{ ... }`:
```
if condition { true-branch } else { false-branch } endif
```

Key difference: Functions create new stack frames, code blocks execute within their containing function's frame.

## 3. Function Stack Frame

When a function is called:

- The return address is pushed onto the return stack (RP)
- The current base pointer (BP) is pushed onto the return stack (RP)
- BP is set to point to the current state of the stack pointer
- Local variable slots are reserved by advancing RP

Stack frame layout:
```
STACK Segment (return stack area):
[ return addr ]
[ previous BP ] ← BP (points to saved base pointer)
[ local N     ]
[ local N-1   ]
...
[ local 0     ] ← RP (grows upward from here)
```

The stack frame is the space between BP and RP.

## 4. Local Variable Declaration

Variables are declared using:
```
value var name
```

Variables can capture values from the data stack, effectively creating formal parameters:
```
: ok
    var b
    var a
    a b add
;
```

When called as `5 3 ok`, values are captured in reverse stack order: `a` gets 3 (TOS) and `b` gets 5.

**Important restrictions:**
- All locals must be declared at the top level of the function, not inside code blocks
- Variables must be declared before use
- Declaration order determines memory offsets

## 5. Variable Access and Addressing

### Address-Based Model

Variable symbols resolve to addresses, not values. This follows TACIT's unified addressing architecture where all memory access uses the same `fetch` and `store` primitives.

Each variable's address is computed at compile time:
```
address = BP + offset
```

Offset calculation:
- First declared variable: offset +4 (BP + 4, first slot above saved BP)
- Second: offset +8 (BP + 8)
- Third: offset +12 (BP + 12)

### Memory Operations

Variable access requires explicit memory operations:
- **Reading a variable**: Push address, then `fetch`
- **Writing a variable**: Push value, push address, then `store`

Stack effects:
```
myvar         ( — addr )       \ Push variable address
myvar fetch   ( — value )      \ Read variable value  
value myvar store ( — )        \ Write variable value
```

### Foundation for Complex Access

Local variables serve as base addresses for complex data structure access. Higher-level addressing operations build upon this foundation using the same `fetch` and `store` primitives.

No runtime name lookup occurs - all address resolution is static.

## 6. Code Block Behavior

Code blocks:
- Push only their return address onto RP
- Do not modify BP
- Access parent function's locals using the same offsets
- Do not clean up the data stack automatically

Example with nested code blocks:
```
STACK Segment (return stack area):
[ return addr ]
[ previous BP ] ← BP (function's base pointer)
[ local N     ]
[ local N-1   ]
...
[ local 0     ]
[ return addr1] (first code block's return address)
[ return addr2] ← RP (second code block's return address)
```

## 7. Function Entry and Exit

**Function Prologue:**
1. Push return address to RP
2. Push current BP to RP
3. Set BP to point to the saved base pointer (current RP - 4 bytes)
4. Reserve slots for all locals by advancing RP

**Function Epilogue:**
1. RP := BP + 4 (drops locals, points to just above saved BP)
2. Pop old BP from RP and restore BP
3. Pop return address from RP
4. Jump to return address

**Code Block Entry:**
1. Push return address to RP
2. Execute block body (no BP modification)

**Code Block Exit:**
1. Pop return address from RP
2. Jump to return address

## 8. Dictionary Management

On function compilation start:
- A dictionary mark is recorded

Each `var` adds a word to the dictionary with:
- Name = variable name
- Value = stack offset from BP
- Kind = local variable

On function end (`;`):
- The dictionary is forgotten back to the function's mark
- This removes all locals, allowing names to be reused in other functions

## 9. Variable Lifetime and Safety

Local variables:
- Are live from point of declaration until function return
- Are addressed via static offsets from BP
- Cannot be returned by reference

Values may be copied from local variables to the data stack (SP) for safe return.

**Illegal operations:**
- Returning references to local variables
- Storing local references in globals
- Variable declarations inside code blocks

## 10. Stack Register Summary

- **SP (Stack Pointer):** 16-bit pointer into STACK segment for data stack operations (computation)
- **RP (Return Stack Pointer):** 16-bit pointer into STACK segment for return stack operations (calls and locals)
- **BP (Base Pointer):** Points to the start of current function's local frame within return stack area
- **IP (Instruction Pointer):** Current instruction location in bytecode

Both SP and RP are pointers into the same STACK segment but operate on different areas:
- BP is updated only on function entry and restored on function exit
- RP is updated for both functions and blocks
- SP operates independently for data stack operations

## 11. Examples

**Basic Variable Access:**
```
: calculate
    10 var a
    5 var b
    a fetch b fetch add    \ Read both variables and add
    c store                \ Store result in another variable
;
```

**Variable as Base Address:**
```
: process-data
    ( 1 2 3 ) var mylist         \ Store a list in variable
    mylist fetch                 \ Get the list address for further operations
;
```

**Illegal Block Declaration:**
```
: fail
    if { 3 var x } then { x } endif  // Error: variable declaration inside block
;
```

## 12. Conclusion

This specification establishes the foundational model for local variables in TACIT functions. Local variables provide stable, compile-time addresses within function stack frames, accessed through explicit `fetch` and `store` operations. Code blocks preserve lexical access to these variables without creating new frames.

This address-based approach forms the foundation for TACIT's unified memory architecture, where all data access - from simple variables to complex data structures - uses the same addressing and memory access primitives. Higher-level addressing mechanisms build upon this foundation while maintaining the same stack discipline and memory safety guarantees.