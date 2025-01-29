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
