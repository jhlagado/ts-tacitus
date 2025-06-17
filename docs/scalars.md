# Scalar values

Tacit’s source code has a small set of literal forms that correspond to the core kinds of data you work with in pipelines.  They are introduced here purely as **surface-syntax**—implementation details (tags, arenas, NaN-boxing, etc.) are covered in the separate *Tagged Values* document.

## 1. Numbers

* **Decimal integer / float** `123` `-7` `3.14`
* **Hex** `0xFF`
  Tacit does not distinguish “integer” vs “float” syntax; the reader selects the most compact internal representation automatically.

## 2. Booleans

Tacit treats `0` as *false* and `1` as *true*.  There are no separate keywords.

## 3. Strings

Double-quoted UTF-8 literals:

```
"hello"
"Line\nBreak"
"π≈3.14159"
```

Standard C-style back-slash escapes are recognised (`\n`, `\t`, `\"`, `\\`, `\xNN`).

## 4. Symbols

A leading **percent** turns an identifier into an interned symbol:

```
%name
%price
%done
```

Symbols are used for record fields, dictionary keys, and (together with `sentinel`) to construct control values.

## 5. Sentinels

A leading **dollar** gives the corresponding sentinel literal:

```
$done
$error
$nil
```

Sentinels are non-data control markers used by `retry`, `fallback`, etc.

## 6. Tuples

Parentheses group one or more literals into a contiguous tuple:

```
(1 2 3)
("a" "b" "c")
( %id 42 "Bob" )
```

*An empty tuple `()` is the canonical **nil** value* and is often used as a placeholder for “no arguments”:

```
()            \ degenerate tuple = nil
```

Tuples nest arbitrarily:

```
(1 (2 3) (4 (5 6)))
```

## 7. Summary

Tacit’s *scalar values* are those that occupy a single slot and can be written directly in source code without auxiliary keywords or blocks.

| Kind         | Syntax examples            | Notes                                                                                                     |
| ------------ | -------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Number**   | `42`  `-7`  `3.14`  `0xFF` | Reader chooses the most compact internal representation (integer or float).                               |
| **String**   | `"hello"`  `"Line\nBreak"` | Double-quoted UTF-8; supports standard back-slash escapes.                                                |
| **Symbol**   | `%name`  `%price`          | Interned identifiers used for record fields, dictionary keys, etc.                                        |
| **Sentinel** | `$done`  `$error`  `$nil`  | Control-flow markers consumed by stages such as `retry` and `fallback`.                                   |
| **Nil**      | `()`                       | The empty tuple is the canonical *nil* placeholder when an argument is required but no value is supplied. |

Strings, symbols, and sentinels are immutable. Numbers are value types; `0` and `1` serve as `false` and `true`. The degenerate tuple `()` is used throughout Tacit for default or “missing” arguments.

