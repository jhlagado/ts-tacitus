## **Access**

### Overview

`get` and `set` are high-level, polymorphic access operators for TACIT data structures.
They provide a uniform way to traverse and optionally modify nested lists, map lists, or mixed structures using a **path**.

Paths are expressed as lists of **indices** (numbers) and/or **keys** (symbols).

* **Numbers** → element index (0-based, element semantics).
* **Symbols** → map key (map list semantics).
* Mixed values → alternate between list and map lookups as traversal proceeds.

A failed lookup at any step produces `nil` and terminates the operation.

### Combinator Form

Both operators are combinators. They consume the value(s) on the left, then execute a **standalone code block** on the right to produce the path.

```
list  get { path-items… }
value list  set { path-items… }
```

The block’s result is always taken as a list representing the path.

### `get`

**Stack effect:**

```
target  get { … }   ⇒   value | nil
```

1. Executes the block, producing a path list.
2. Traverses the target using the path:

   * Numbers → list element access.
   * Symbols → map key lookup.
3. Returns the final value, or `nil` if any step fails.

**Examples**

```
root  get { 2 }                      \ get root[2]
root  get { `name }                  \ get root[`name]
root  get { 3 `address `postcode }   \ nested lookup
root  get { `users 0 `email }        \ mixed types in path
```

If any index is out-of-bounds, or a key is absent with no default, `nil` is returned immediately.

### `set`

**Stack effect:**

```
value  target  set { … }   ⇒   ok | nil
```

1. Executes the block, producing a path list.
2. Traverses the target just like `get`.
3. If traversal fails → returns `nil`.
4. If it lands on a **simple element** → overwrites it with `value`, returns `ok`.
5. If the target is **compound** (list, capsule, etc.) → no change, returns `nil`.

**Examples**

```
3  list  set { 7 }                      \ list[7] = 3
"Jane"  root  set { `users 0 `name }    \ set users[0].name
0  root  set { `stats `count }          \ set stats.count
```

**Notes**

* Only **simple values** may be written (`number`, `boolean`, `string`, `symbol`, `nil`).
* No structural edits: `set` does not insert keys or extend lists.

### Example Structure

```
\ Root object
(
  `users (                           \ key: users
    ( `name "Alice" `age 30 )         \ element 0
    ( `name "Bob"   `age 25 )         \ element 1
  )
  `stats ( `count 2 `active true )
  `items ( 10 20 30 )
)
```

**Access with `get`**

```
root  get { `users 1 `name }    \ → "Bob"
root  get { `stats `count }     \ → 2
root  get { `items 0 }          \ → 10
root  get { `users 2 `name }    \ → nil (out of bounds)
```

**Modify with `set`**

```
"Charlie" root set { `users 0 `name }  \ users[0].name = "Charlie"
99       root set { `items 1 }         \ items[1] = 99
root get { `users 0 `name }            \ → "Charlie"
```

### Summary

* **Uniform path traversal** across lists and map lists.
* **Numbers** = element index; **symbols** = map key.
* `get` returns a value or `nil`.
* `set` modifies simple values in-place, returns `ok` or `nil`.
* Always uses the combinator form: target, operator, path block.
* Designed to replace low-level `element` and `slot` access for most use cases.
