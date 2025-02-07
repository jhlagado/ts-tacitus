Tech notes about Tacit

This vm is for a new programming language called Tacit which is intended to run on more a restrictive system than the JavaScript VM. This is a prototype for something that may be converted to C and even assembly language. I want you to keep that in mind when making any suggestions. The memory space is only 64K and uses 16 bit pointers. The main data type is the number (a 32 bit floating point number) and the multi-dimensional array. There is an extension to the Float32 format in which the 23 bit mantissa of a NaN float is used to store tagged data. 3 bits are used for the tag and the remaining 20 bits are used for data.
The language uses reverse polish notation like PostScript or Forth but it is a new language more closely modelled after array programming languages such as APL or J
The language processes arguments by using a stack but there is a second stack for storing return addresses and there is no concept of stack frames.
in order to prevent cyclical references, arrays are copy on write but to make this efficient, we use structural sharing (like with Clojure), this means cloning the part of the array you are updating but reusing the rest without copying. when updating an array using copy-on-write we need to clone each array block.
This is obviously very inefficient so we only do it to the block that changes and all the blocks earlier but later blocks don't need to be cloned, we can simply share their structure. This is a persistent data structure which maintains immutability by only cloning the least amount. This is like Clojure.

No garbage collection
Using reference counting (see BLOCK_REF) and immutable copy on write, 
immutability inspired by persistent data structures with structural sharing (see Clojure)
No fragmenation problem because all blocks are the same size (BLOCK_SIZE) and larger blocks are made by linking them together (BLOCK_NEXT)
Array laguage similar to APL or J
Stack-based RPN language similar to PostScript and Forth, no stack frames. two stacks, one for data the other for returns, similar to Forth
No local variables
State is held on the stack. there may be some global variables (havent decided yet), vectors can contain pointers to other heap allocated objects though so reference counting
decides the lifespan of objects. The main form of ownership of objects is the stack

No loops or recursion. The language is based on iterators and combinators and operators such as each, reduce, scan etc and not lambda calculus. 
Byte code compilation, RPN functions are easily composed, no closures


literal arrays
ranges
interned strings / symbols
< and > may be used as special syntax
{ } for code blocks
[ ] for literal arrays
syntax needed for n-fork

a fork might be represented using parenthese ( ) or < >
a quoted primtive e.g. `+ might be shorthand for {+}
i.e. `+/ as opposed to {+}/

| **Category**                         | **Monadic**                                                                                                                    | **Dyadic**                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| **Arithmetic & Mathematical**        | `abs`, `neg`, `sign`, `exp`, `ln`, `log`, `sqrt`, `pow`, `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `floor`, `ceil`, `round` | `+`, `-`, `*`, `/`, `\`, `mod`, `pow`, `min`, `max`, `avg`, `prod`     |
| **Comparison**                       |                                                                                                                                | `=`, `>`, `<`, `>=`, `<=`, `<>`                                        |
| **Logical**                          | `not`                                                                                                                          | `and`, `or`, `any`, `all`, `xor`, `match`                              |
| **Aggregation**                      | `sum`, `avg`, `prod`, `max`, `min`, `len`, `first`, `last`, `enlist`, `distinct`, `group`                                      | `count`, `group`, `ungroup`                                            |
| **Structural**                       | `each`, `scan`, `raze`, `unite`, `flip`, `transpose`, `enlist`, `reverse`                                                      | `take`, `drop`, `first`, `last`, `remove`, `insert`, `flip`, `reverse` |
| **Type Conversion**                  | `int`, `float`, `char`, `symbol`, `date`, `time`                                                                               | `cast`                                                                 |
| **Data Operations**                  | `distinct`, `group`, `ungroup`, `update`, `delete`, `insert`, `extend`                                                         | `join`, `merge`, `update`, `insert`, `delete`, `extend`                |
| **Set Operations**                   | `intersect`, `union`, `except`, `symdiff`                                                                                      | `intersect`, `union`, `except`, `symdiff`                              |
| **Search/Filter**                    | `in`, `like`, `where`, `contains`, `index`, `find`, `grep`                                                                     | `in`, `like`, `where`, `contains`, `index`, `find`, `grep`             |
| **Window Functions**                 | `window`, `rank`, `row_number`, `partition`                                                                                    | `scan`, `reduce`, `window`, `rank`, `row_number`                       |
| **String Operations**                | `string`, `substring`, `length`, `replace`, `split`, `join`, `ucase`, `lcase`, `char`, `toLower`, `toUpper`, `reverse`, `trim` | `string`, `substring`, `replace`, `split`, `join`, `find`              |
| **Datetime**                         | `date`, `time`, `now`, `timestamp`, `today`, `year`, `month`, `day`, `hour`, `minute`, `second`, `floor`, `ceil`               | `date`, `time`, `timestamp`, `add`, `sub`, `diff`, `floor`, `ceil`     |
| **Random & Sampling**                | `rand`, `raze`, `flip`, `sample`, `uniform`, `normal`                                                                          | `rand`, `flip`, `sample`, `uniform`, `normal`, `weighted`              |
| **Miscellaneous**                    | `null`, `type`, `count`, `enlist`, `assert`, `assert!`                                                                         | `assert`, `assert!`, `assertType`, `extend`                            |
| **Control Flow**                     | `if`, `while`, `each`, `case`                                                                                                  | `if`, `switch`, `ifElse`, `case`                                       |
| **Mathematical Operations on Lists** | `sum`, `prod`, `min`, `max`, `mean`, `stdev`                                                                                   | `sum`, `prod`, `min`, `max`, `mean`, `stdev`, `median`                 |
| **Transformations**                  | `flip`, `transpose`, `reverse`                                                                                                 | `unite`, `raze`, `flip`, `enlist`, `transpose`                         |
| **Flow**                             | `each`, `scan`, `eachRight`, `map`, `fold`                                                                                     | `reduce`, `scan`, `fold`, `map`, `eachLeft`, `reduceBy`                |
| **Performance Optimizations**        | `flip`, `groupBy`, `ungroup`, `unite`                                                                                          | `unite`, `group`, `ungroup`, `merge`                                   |
