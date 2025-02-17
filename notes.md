
## 1. **High-Level Architecture**

1. **Memory Model**  
   - A single 64 KB region (in 16-bit addressing) is managed by a `Heap` class using **fixed-size blocks** (64 bytes each).  
   - Each allocated block has a small header (next pointer + reference count), so allocations link into a free list.  
   - Large data structures (e.g. vectors, sequences) are built by **chaining** these 64 byte blocks together.

2. **Tagged Floats**  
   - The language stores “pointers” and small integers in a 32 bit IEEE 754 float by embedding them in the NaN space (NaN‐boxing).  
   - Each pointer or integer is a “NaN float” with a 3 bit tag, e.g. `Tag.VECTOR`, `Tag.VIEW`, `Tag.SEQ`.  
   - A special value **UNDEF** (=-2147483648 in integer representation) signals an invalid or out-of-bounds result.

3. **Reference Counting**  
   - Each 64 byte block has a 16 bit reference count.  
   - On each “push” or duplication, the reference count increments; on “free” or “drop,” it decrements.  
   - Blocks whose reference count hits zero return to the free list.

---

## 2. **Core Data Structures**

1. **Vectors**  
   - Stored in a chain of blocks. The first block’s first 8 bytes hold length and a reserved field; the remaining space holds 4 byte floats.  
   - Large arrays (vectors) chain multiple 64 byte blocks.  
   - **Copy-on-write**: If a vector block is shared, the language clones (via `cloneBlock`) before mutating.

2. **Views**  
   - A “view” references a vector (or another view) plus shape/stride info for multidimensional usage.  
   - Typically, one block suffices: it has a pointer to the underlying vector, a rank, an offset, and the shape/stride arrays.  
   - If out of bounds or invalid tag, operations return **UNDEF**.  
   - **Copy-on-write** is used if the underlying vector is shared.

3. **Sequences**  
   - “Sequences” unify iteration logic for sources and processors.  
   - They have a 64 byte block with fields: parent pointer (vector/view/another seq), major position, total slices, a reusable slice view, and rank.  
   - A **processor flag** plus a processor opcode can designate transformations like map, filter, scan, drop, slice, etc.

---

## 3. **Implementation of Sequences**

1. **Sequence Blocks**  
   - One 64 byte block contains:
     - **Parent pointer**: The underlying data or prior sequence.  
     - **Major position**: Current index along the main axis.  
     - **Total**: How many slices/elements remain.  
     - **Slice view**: A pointer to a “reusable” child view.  
     - **Rank**: The dimensional rank for multidimensional data.  
     - **Processor fields**: A flag (PROC_FLAG), a processor type (PROC_TYPE), plus parameters (PROC_PARAM) and state (PROC_STATE).

2. **Iteration (`seqNext`)**  
   - Reads the current “major position,” checks if we’re at the end.  
   - If **processor** flag is set, calls `processorNext`.  
   - If it’s a normal source: either offsets a view or, in a dynamic range, just adds the position to the start.  
   - `seqNext` returns a scalar (if rank=0 or dynamic range) or a sub‐view (for higher rank).

3. **Processor Sequences**  
   - If `PROC_FLAG=1`, the iteration calls `processorNext`, which calls `seqNext` on the underlying source, transforms the result based on `PROC_TYPE`.  
   - Common transformations:
     - **MAP**: multiply by param.  
     - **FILTER**: skip values below threshold.  
     - **SCAN**: keep a running sum in state.  
     - **DROP**: skip N items on first iteration.  
     - **SLICE**: skip “start” items on the first iteration, then only produce “count” total.  
     - **TAKE**: override total to produce only N items.  
     - **FLATMAP**: merges or passes sub‐sequences, typically placeholder.

---

## 4. **Design Philosophy**

1. **Tacit / Point-Free**  
   - The language tries to avoid explicit arguments, using transformations that operate on entire sequences.  
   - Emphasizes functional array style reminiscent of APL/J, in a small memory environment.

2. **Unified Format**  
   - All sequences (sources or processors) share the same block layout.  
   - A single iteration function (`seqNext`) handles normal data or transformations.

3. **Copy-on-Write**  
   - Both vectors and views adopt a “shared‐until‐mutated” model. If refCount > 1, the block is cloned before altering data.  
   - This prevents side effects but saves memory usage for read‐only data.

4. **Chaining**  
   - Processors return standard “sequence blocks,” enabling pipeline composition: 
     - Source → map → filter → scan → sink.  
   - Sinks only call `seqNext` repeatedly until **UNDEF**.

5. **RPN / Postfix**  
   - The language can parse or interpret in a stack-based manner.  
   - e.g. `[1,2,3] filter(>2) map(*3) reduce(+)` in postfix form.  
   - ASCII operators like `->M`, `/-R`, `->>S` can be used if desired.

---

## 5. **Key Files**

- **constants.ts**:  
  - Defines macros or constants (`TRUE`, `FALSE`, `NULL`, etc.).
- **memory.ts**:  
  - Manages the raw 65536 byte array, has read/write (8/16/float).
- **heap.ts**:  
  - Manages the 64 byte blocks, keeps a free list, handles reference counting & copy-on-write logic.
- **vector.ts**:  
  - Creates & updates numeric vectors with chaining. Does copy-on-write if refCount>1.
- **view.ts**:  
  - Allows slicing or multidimensional indexing of vectors. Also uses copy-on-write if needed.
- **source.ts**:  
  - Functions like `seqFromVector` or `seqFromRange` produce initial sequences (source sequences).
- **sequence.ts**:  
  - Defines the “sequence block” layout & `seqNext` iteration. If the block is a processor, calls `processorNext`.
- **processor.ts**:  
  - Builds sequences that transform data: map, filter, scan, drop, slice, etc. They all produce standard “SEQ” blocks.
- **sink.ts**:  
  - E.g. `seqReduce`, `seqRealize` that repeatedly call `seqNext` to consume sequences.

---

**Summary**  
This tacit style language (point-free, array-based) uses a uniform 64 byte block layout with a single iteration function. Both raw data (vectors, views) and higher-level transformations (processors) appear as “sequences,” so **chaining** is natural. Memory safety is ensured by reference counting and copy-on-write. This approach fosters a pipeline model reminiscent of APL/J in a minimal, embedded-friendly heap architecture.



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
