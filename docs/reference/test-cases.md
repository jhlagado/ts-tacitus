# TACIT Test Cases and Examples

## Stack Operation Examples

### Basic Arithmetic

```tacit
# Input: 2 3 add
# Stack: [] → [2] → [2,3] → [5]
# Effect: ( a b — sum )

# Input: 5 dup mul
# Stack: [] → [5] → [5,5] → [25]
# Effect: ( n — n² )
```

### List Construction

```tacit
# Input: ( 1 2 3 )
# Conceptual stack (top on right): [... 3 2 1 LIST:3]
# Effect: ( — list )  ; header at TOS, payload slots beneath

# Empty list
# Input: ( )
# Stack: [... LIST:0]
# Effect: ( — empty-list )
```

### Nested Lists

```tacit
# Input: ( 1 ( 2 3 ) 4 )
# Stack representation (top on right):
# ... 4 LIST:2 3 2 1 LIST:5
#              ^^^^^ inner list (payload 2 + header)
```

## Code Reference Examples

### Quotations

```tacit
# Creating executable reference
{ 1 2 add }           # → Tag.CODE(bytecode_addr)
{ dup mul }           # → Tag.CODE(bytecode_addr)

# Executing references
3 { dup mul } eval    # → 9
```

### Symbol References (Planned)

```tacit
# Built-in references
@add                # → Tag.BUILTIN(Op.Add)
@dup                # → Tag.BUILTIN(Op.Dup)

# Colon definition references
: square dup * ;
@square             # → Tag.CODE(bytecode_addr)

# Unified execution
2 3 @add eval       # → 5
4 @square eval      # → 16
```

## VM State Examples

### Clean VM State

```typescript
Stack: [];
RStack: [];
IP: 0;
SP: 0;
RP: 0;
BP: 0;
```

### After Operations

```typescript
// After: 5 dup
Stack: [5, 5];
SP: 8; // 2 elements × 4 bytes

// After function call
RStack: [return_addr, old_BP];
BP: 8; // Points to current frame
```

## Error Scenarios

### Stack Underflow

```tacit
# Empty stack, attempt pop
add                   # Error: Stack underflow

# Insufficient operands
5 add                 # Error: Need 2 operands, have 1
```

### Type Mismatches

```tacit
# Attempting arithmetic on non-numbers
"hello" 5 add         # Error: Type mismatch

# Invalid list operations
5 car               # Error: Not a list
```

## Performance Test Cases

### Large Lists

```tacit
# 1000-element list
( 1 2 3 ... 1000 )

# Nested structure
( ( 1 2 ) ( 3 4 ) ( 5 6 ) )
```

### Deep Nesting

```tacit
# Deeply nested lists
( 1 ( 2 ( 3 ( 4 ( 5 ) ) ) ) )
```

### Symbol Table Stress

```typescript
// Many symbols
for (let i = 0; i < 100; i++) {
  symbolTable.defineBuiltin(`op_${i}`, i % 128);
  symbolTable.defineCode(`word_${i}`, 1000 + i);
}
```

## Integration Test Scenarios

### Complete Workflows

```tacit
# Mathematical expression: (3+4) * (5+6)
3 4 add 5 6 add mul       # → 77

# List processing
( 1 2 3 ) { dup mul } map  # → ( 1 4 9 )

# Control flow
5 { 10 > } { "big" } { "small" } if
```

### Memory Management

```tacit
# Large computation without leaks
: factorial
  dup 1 = { drop 1 } { dup 1 - factorial * } if ;

10 factorial        # → 3628800
```

## Expected Outputs

### Successful Operations

```
Input: 2 3 +
Output: Stack [5]

Input: ( 1 2 3 ) length
Output: Stack [3]
```

### Error Messages

```
Input: +  # Empty stack
Output: Error: Stack underflow: 'add' requires 2 operands (stack: [])

Input: 5 "hello" +
Output: Error: Type mismatch: expected number, got string
```
