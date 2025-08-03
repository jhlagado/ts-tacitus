# TACIT Stack Operations Specification

## Fundamental Stack Model

TACIT uses a **data stack** where all computation occurs. Understanding stack mechanics is critical for correct implementation and reasoning about program behavior.

## RPN: Immediate Execution Model

**Key Insight**: RPN (Reverse Polish Notation) executes operations **immediately** upon encountering them, unlike prefix notation (like Lisp) which collects all arguments first.

**RPN characteristics**:
- **Streamable**: Operations execute as soon as they're encountered
- **Stack-dependent**: Arguments must already be on stack before operation
- **Immediate**: No delay or buffering of operations

**This creates seemingly "backwards" behavior**:

```tacit
1 2 3           # Push three values
```

**Results in stack**:
```
[ 1 2 3 ]      # 3 is TOS (rightmost)
```

**When printed with successive pops**:
```tacit
1 2 3 . . .    # Three print operations
```

**Output appears as**:
```
3 2 1          # Prints TOS first, then next, then bottom
```

**This is standard stack behavior** - not a bug or confusion, but the natural result of Last-In-First-Out (LIFO) ordering.

## Stack Visualization

```
Stack grows upward (toward TOS):

[item4]  ← Bottom of Stack (BOS)
[item3]
[item2]  
[item1]  ← Top of Stack (TOS) - where operations happen
```

**Critical Rule**: All operations occur at the **Top of Stack (TOS)** - the rightmost position in stack effect diagrams.

## Stack Effect Notation

Stack effects show the before and after state using this format:
```
( before — after )
```

**Reading Stack Effects**:
- Rightmost item is **always** TOS
- Operations consume items from TOS (right side)
- Results are pushed to TOS (right side)
- Stack grows and shrinks from the right

### Examples

```tacit
dup    ( a — a a )           # Copy TOS
swap   ( a b — b a )         # Exchange top two items  
drop   ( a — )               # Remove TOS
rot    ( a b c — b c a )     # Rotate three items
add    ( a b — sum )         # Add top two items
```

## Stack Representation in Documentation

When showing stack contents, we use this convention:
```
[bottom] [item2] [item3] [TOS]
```

**Key Points**:
- Read left to right as bottom to top
- Rightmost position is TOS
- Operations affect rightmost items
- New items appear on the right

## Common Operations by Arity

### Nullary (0 inputs, 1 output)
```tacit
42     ( — 42 )              # Push literal
```

### Unary (1 input, 1 output)
```tacit
dup    ( a — a a )           # Duplicate TOS
abs    ( a — |a| )           # Absolute value
not    ( a — ¬a )            # Logical negation
```

### Binary (2 inputs, 1 output)
```tacit
add    ( a b — a+b )         # Add (b is TOS)
sub    ( a b — a-b )         # Subtract b from a
mul    ( a b — a*b )         # Multiply
div    ( a b — a/b )         # Divide a by b
```

### Stack Manipulation
```tacit
drop   ( a — )               # Remove TOS
swap   ( a b — b a )         # Exchange top two
over   ( a b — a b a )       # Copy second item to TOS
rot    ( a b c — b c a )     # Rotate top three
```

## Critical Mental Model Rules

### 1. TOS is Always Rightmost
❌ **Wrong**: Thinking TOS is leftmost or index 0
✅ **Correct**: TOS is rightmost in all representations

### 2. Operations Consume from TOS
❌ **Wrong**: `( a b — a+b )` where a is TOS  
✅ **Correct**: `( a b — a+b )` where b is TOS

### 3. Stack is Not an Array
❌ **Wrong**: Accessing elements by index
✅ **Correct**: Only TOS elements are directly accessible

### 4. Data Flow Direction
❌ **Wrong**: Thinking operations flow left-to-right
✅ **Correct**: Operations consume from right, produce to right

## Execution Examples

### Understanding "Reverse" Output
The most confusing aspect of stack programming for newcomers:

```tacit
1 2 3 4 5
```

**Creates stack**:
```
[ 1 2 3 4 5 ]  # 5 is TOS
```

**Printing each item**:
```tacit
. . . . .      # Five print operations
```

**Output sequence**:
```
5
4  
3
2
1
```

**Why this happens**:
1. Each number pushes onto TOS immediately
2. Print (`.`) pops and displays current TOS
3. Stack naturally yields LIFO order
4. This is **correct behavior**, not an error

### Simple Arithmetic
```tacit
5 3 add
```

**Step by step**:
```
Initial: [ ]
Push 5:  [ 5 ]
Push 3:  [ 5 3 ]          # 3 is TOS
add:     [ 8 ]            # Consumes 5 and 3, produces 8
```

### Stack Manipulation
```tacit
1 2 3 swap
```

**Step by step**:
```
Initial: [ ]
Push 1:  [ 1 ]
Push 2:  [ 1 2 ]
Push 3:  [ 1 2 3 ]        # 3 is TOS
swap:    [ 1 3 2 ]        # Exchanges 3 and 2
```

### Complex Expression
```tacit
10 5 2 mul sub
```

**Step by step**:
```
Initial:    [ ]
Push 10:    [ 10 ]
Push 5:     [ 10 5 ]
Push 2:     [ 10 5 2 ]    # 2 is TOS
mul:        [ 10 10 ]     # 5*2=10, result is TOS
sub:        [ 0 ]         # 10-10=0
```

## Advanced Concepts

### Arity and Stack Safety
- **Arity**: Number of arguments an operation consumes
- **Stack underflow**: Attempting to pop from empty stack
- **Type checking**: Ensuring stack has enough items

### Stack Effect Composition
Operations compose by matching output of one to input of next:
```tacit
( — a )  ( a — b )  ( b — c )  ≡  ( — c )
```

### Conditional Operations
```tacit
if     ( flag true-branch false-branch — result )
```
The flag (deepest item) determines which branch executes.

## TACIT-Specific Considerations

### Tagged Values
All stack items are 32-bit NaN-boxed values with type tags:
- Operations must respect type constraints
- Stack effects include type information where relevant

### Code Blocks
```tacit
{ 1 2 add }    ( — code-block )
```
Blocks are pushed as executable references, not executed immediately.

### Symbol References
```tacit
@add           ( — symbol-ref )
```
@ prefix creates references to operations for metaprogramming.

## Common Pitfalls for AI Systems

1. **Index Confusion**: Treating stack like array[0] = TOS
2. **Direction Errors**: Reading stack effects backwards
3. **Arity Mistakes**: Not counting consumed arguments correctly
4. **Composition Errors**: Misunderstanding how operations chain
5. **Side Effect Confusion**: Not tracking what remains on stack

## Verification Strategies

When implementing stack operations:
1. **Draw stack states** before and after each operation
2. **Count arity** - ensure enough items available
3. **Trace data flow** from input through transformation
4. **Verify composition** - outputs match next inputs
5. **Test edge cases** - empty stack, single items, etc.

## Related Specifications

- `docs/specs/tagged.md` - Type system for stack items
- `docs/specs/lists.md` - List structures and LINK metadata
- `docs/specs/vm-architecture.md` - Memory layout and execution model
