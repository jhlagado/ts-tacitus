
## 🧭 Goals of the Compiled Sequence System

The core aim is to compile lazy pipelines (like `range → map → filter`) into efficient, low-level code with the following properties:

1. **No closures or runtime allocation for functions**
2. **Reusability**: compiled code can be shared across instances
3. **Encapsulation**: each pipeline stage has its own state and behavior
4. **Full laziness**: data is pulled one item at a time
5. **Predictable memory layout**: everything has fixed offsets, no hidden fields
6. **Object-oriented**: execution context is bound to data like a method in a class

This leads naturally to an **object-dispatch model**, where calling an object means "execute this code in the context of this data."

---

## 🧱 Object Layout (Sequence Instance)

Every sequence stage is represented as a heap-allocated object with a fixed memory layout.

```
+--------------------+ offset 0
| code_ptr           | → pointer to compiled bytecode block
+--------------------+ offset 4
| (optional fields)  | → e.g., type ID, child reference
+--------------------+
| stage-local state  | e.g., range index, scan accumulator
+--------------------+
```

* **Slot 0**: Always the function pointer (`code_ptr`)
* The rest of the block is **owned by the stage**

  * Variables
  * Metadata (if needed)

---

## 🧠 Execution Context: `self`

* The VM contains a register: `VM.self`
* This points to the current object’s memory (the block described above)
* **All `LOAD_IMM` and `STORE_IMM` access memory relative to `self`**

By default, `VM.self = NULL` and the system runs in global context. But:

> When you `DISPATCH` an object, you enter its context. You set `self` to that object.

---

## 🔧 The `DISPATCH` Instruction

This is how you **invoke** an object—i.e., run its method (`next` or `restart`) with its own data.

### Behavior:

1. Push current `pc` (return address) to return stack
2. Push current `self` to return stack
3. Load `code_ptr = *(object + 0)`
4. Set `VM.self = object`
5. Jump to `code_ptr + selector` (selector = 0 for `next`, 1 for `restart`)

You could model it as:

```
DISPATCH selector, object_ptr
```

Or use two separate opcodes for clarity:

* `DISPATCH_NEXT object_ptr`
* `DISPATCH_RESTART object_ptr`

---

## 🔄 Returning from an Object

At the end of a stage, the compiled code issues `RET`. The VM pops:

1. Previous `self`
2. Previous `pc`

This restores the caller’s context—either a previous object or the global context.

---

## 🛠 VM Changes

1. Add a `self` register to the VM (like a `this` pointer)
2. Modify `RET` to restore `self`
3. Modify `DISPATCH` to save/restore `self` like a full method call
4. Ensure all `LOAD_IMM`/`STORE_IMM` read from `[self + offset]`

---

## 📦 Pipeline Data Layout (Shared State)

In multi-stage pipelines, all state can be stored in a **single flat block**—you don't need separate objects per stage unless you want polymorphism.

Each stage is assigned a slice:

| Offset | Bytes | Used by          |
| ------ | ----- | ---------------- |
| 0      | 4     | range.index      |
| 4      | 4     | range.limit      |
| 8      | 4     | scan.accumulator |

The compiled code uses fixed offsets like:

```text
LOAD_IMM 0    ; range.index
STORE_IMM 8   ; scan.accumulator
```

So even if multiple objects share the same `code_ptr`, they will still operate independently based on their `self` pointer.

---

## 🔁 Compiling a Multi-Stage Pipeline

Let’s say you compile:

```tacit
range(5) → scan [+]
```

You allocate:

* One state block with offsets: `index`, `limit`, `accumulator`
* One object that contains:

  * Slot 0: pointer to compiled code block
  * Slots 1+: state variables
* Compiled code:

  * Entry at offset 0: `next`
  * Entry at offset 1: `restart`

When the pipeline is run:

* The sink issues `DISPATCH_NEXT pipeline_object`
* The code runs with `self` = `pipeline_object`
* State is accessed using immediate offsets from `self`
* Calls to earlier stages are just `CALL` into previously emitted code, using `self` to locate the shared state

---

## ✅ Summary

* Objects = closures without hidden machinery
* Calling an object = switching context
* `self` is saved and restored on the return stack
* Sequences are compiled as reusable code blocks with relative state access
* All context (code + data) is explicit and low-cost

