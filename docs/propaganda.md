## **1. Execution Model**

Tacit is based on a **stack-oriented virtual machine** (VM) inspired by Forth but adapted for modern usage, embedded targets, and higher-level structural semantics. The core of its execution strategy is built around **stack discipline**, **resumable functions**, and **cooperative multitasking**, offering a robust and low-overhead alternative to closure-based, heap-driven runtime models.

### 1.1. **Stack-Centric Design**

Tacit distinguishes between two primary stacks:

* **Data Stack** – Used for transient values, function inputs/outputs, and intermediate results.
* **Return Stack** – Used for managing function calls, local variables, scope boundaries, and control state. This stack becomes the anchor for **persistent state** in resumables.

Unlike traditional Forth, Tacit minimizes use of the data stack by introducing **lexical local variables**, stored on the return stack. This reduces the need for stack juggling (e.g. `dup`, `swap`) and allows deeper functional composition while retaining execution clarity.

### 1.2. **Resumables as Core Abstraction**

Resumables are Tacit's core coroutine-like primitive, but they are *not* closures, threads, or OS processes. Instead:

* A **resumable** is a function with two entry points: `init` (first invocation) and `mainline` (for all subsequent resumptions).
* The `init` call allocates a frame on the return stack and may yield a **handle**, which is just a pointer to that frame.
* On yield, the function suspends itself and returns its saved instruction pointer (via code offset) and base pointer (BP) as part of the handle.
* On resume, the `mainline` entry is invoked using this handle.

The resumable maintains its state *on the return stack only*, which avoids heap allocation and garbage collection. There is no dynamic closure environment; instead, **stack discipline and promotion** govern visibility and lifetime.

Resumables support **nesting**, **promotion**, and **scoped suspension**. When nested, a child resumable can optionally **promote** part of its state to the parent scope, thus allowing its continuance beyond its creator’s lifetime. This is managed by not trimming the return stack down to the old BP, effectively *expanding* the parent’s scope with child variables.

### 1.3. **Cooperative Multitasking**

Tacit provides **cooperative multitasking** between resumables:

* Tasks (resumables registered for scheduling) yield explicitly, and the scheduler chooses the next task.
* Yielding does **not return**; it suspends the current function and jumps to the next task in a global scheduler list (typically a linked list).
* Execution continues from the suspended instruction on the next resume.

Because of the cooperative model:

* There is **no need for locks or preemption**.
* All shared state must be coordinated via message passing or explicit yield discipline.

### 1.4. **Trampolined Execution Model**

For sequences or pipelines (e.g. source → transform → sink), Tacit uses a **trampoline model**:

* Each stage is compiled as a resumable.
* Execution is initiated by the consumer stage (pull model).
* Stages execute in order, then yield control upward or sideways.
* Looping (iteration over sequences) is *not embedded* in the stage function but is performed by the trampoline or the downstream consumer.

The trampoline:

* Manages forward progression in the pipeline.
* Invokes each stage’s `mainline`, and yields control when needed.
* Avoids embedding iteration inside each resumable, keeping stage code minimal and restartable.

### 1.5. **Yield Semantics**

Yielding in Tacit is a **language-level primitive**, not an effect:

* It does **not return**; it’s a control jump to the next scheduled task.
* It can occur inside loops, function calls, or blocking I/O.
* Loops can be compiled to **yield conditionally**, e.g. after N iterations or after a timeout.
* Yield **must not corrupt the stack**—all local variables are preserved in the frame; the data stack must be clean.

While yields can be explicitly encoded (e.g. advanced use cases), Tacit will support **implicit yields** in loops or blocking operations, guided by annotations or compile-time policy (e.g. yield after 10,000 cycles or 5ms of CPU time).

### 1.6. **Round-Robin Scheduler**

The default task manager is a **round-robin scheduler**:

* Tasks are stored in a singly linked list.
* When a task yields, the next one is selected.
* Tasks can add themselves or others to the list using their handles.
* Deleting tasks is done by trimming the list or exiting the owning ancestor frame.

This scheduler is:

* **Simple** (O(1) or O(n) ops only).
* **Deterministic**, perfect for real-time and embedded systems.
* Open to extension (priority-based queues, timed wakeups, etc.)

### 1.7. **Control Flow Is Data-Driven**

Because resumables are **state machines**, control flow is no longer a top-down sequence of calls and returns. Instead:

* Tasks represent ongoing logical processes (like actors).
* Their state is encoded in local variables.
* Flow between them happens via data exchange or handle calls.

This produces a **dataflow-style architecture** without the need for closures, event loops, or continuation-passing style. Resumables can be seen as **objects with control flow**, but without heap-resident dispatch mechanisms.

## **2. Memory Model**

Tacit’s memory model is built on **explicit stack management**, **manual lifetime control**, and **predictable allocation**. It rejects garbage collection and traditional heap-oriented lifetimes in favor of a blend of **return-stack-based locals**, **bump allocation**, and **arena-style resource ownership**. The goal is zero-cost abstraction for stateful, concurrent, and embedded execution.

### 2.1. **Two Stacks, Two Roles**

Tacit distinguishes between:

* **Data Stack**: Short-lived, expression-level intermediates. Used for argument passing, calculation results, and short-term manipulation.
* **Return Stack**: Long-lived state, including function locals, return addresses, base pointers, and most critically: the storage for resumables and promoted variables.

The return stack acts as both a **frame allocator** and a **scope register**. Function frames are laid out contiguously. Locals are constants (single-assignment), and lifetime is managed by resetting the stack pointer to the saved base pointer (`bp`) on return — unless promotion occurs (see 2.4).

### 2.2. **Frame Layout**

Each function call builds a stack frame on the return stack:

* Two words are always pushed: the **return address** and the **previous base pointer**.
* Then, space is allocated for the function’s **local variables** (known at compile time).
* The base pointer is updated to the current top of stack before variable allocation.

This simple discipline makes stack walking trivial: each frame is a self-contained region, bounded by its `bp`, with return and caller context preserved beneath it.

Resumable frames are identical, except they preserve their base pointer on yield and store their re-entry address separately, forming a **handle**.

### 2.3. **Tagged Handles**

A **handle** is a tagged pointer to a saved frame on the return stack. It contains:

* A code pointer to the `mainline` resume entry.
* A reference (or offset) to the saved `bp`.

It does **not** reference the data stack or require heap allocation. Ownership of the handle is defined by scope: if the return stack region is valid, the handle is valid. If the owning ancestor frame is cleaned up, the handle becomes invalid.

Handles allow long-lived logic units (e.g. processes, tasks, iterators) to be called repeatedly, without heap structures or closures.

### 2.4. **Promotion and Retained Locals**

Promotion is Tacit’s alternative to closures. When a child function **promotes** one or more of its locals:

* It **chooses not to restore** the return stack to its original `bp` on exit.
* Instead, it leaves a portion of its frame intact, which becomes **part of the parent’s new scope**.
* Promotion is a convention: the child marks where cleanup stops, and the parent inherits everything beyond that.

This creates *stack-based lexical extension* — functions extend their parent’s state without copying or heap boxing.

Promotion is opt-in and under full programmer (or compiler) control. It enables:

* Stateful tasks launched from pure functions.
* Persistent data in generators.
* Sharing of state between siblings or cousins (if they share a common ancestor).

### 2.5. **No Garbage Collection**

Tacit avoids GC entirely. It uses:

* **Stack discipline** for most memory.
* **Bump-allocated arenas** for temporary heap-style allocations.
* **Reference counting** only where sharing is explicitly required (e.g. shared sequences or objects).

Arena allocation is favored where ownership is clear:

* A structure is allocated once, used for a bounded period, and discarded wholesale.
* This fits patterns like macro expansion, parsed token streams, or short-lived buffers.

The allocator simply **increments a pointer** to allocate and resets to a mark to deallocate. There’s no fragmentation and no need for per-object free.

When reference counting is used, it is:

* Per-object.
* Simple (retain/release).
* Paired with clear transfer-of-ownership rules.

This model is aligned with **Rust-like discipline** but mapped onto a much simpler VM.

### 2.6. **Memory Safety via Discipline**

Memory safety is enforced not by runtime checks but by **strict scoping**:

* Variables live only between their declaration and the return to the saved `bp`.
* Promotion makes this window longer, but always explicit.
* There are no wild pointers because all access is offset-based from known frame roots.
* Structs and objects are manipulated via handles, not raw pointers.

Because there's no GC, there are no invisible retention paths. If a handle or reference survives, it's because it was *promoted* or *explicitly retained*.

### 2.7. **Structs and State Objects**

Tacit structs:

* Are declared with `struct-def`, which defines named offsets and total size.
* Are instantiated with `struct`, which allocates local storage.
* Are accessed using `with`, which binds a base address and allows field access via symbolic offsets.

Structs are **flat**, **non-nested**, and passed by reference (stack address or handle). They support:

* Code pointer fields (for method-like behavior).
* Polymorphism via tagged slots.
* Zero-cost sharing if allocated on the return stack.

Heap-allocated structs follow the same layout but are created via bump allocation or retained via reference counting if necessary.

### 2.8. **Memory Model and Tasks**

Each task (resumable) lives in a frame. When tasks are suspended:

* Their stack state is retained (by design).
* Their handle can be passed to other tasks.
* Their memory is owned by the **ancestor frame** (not the scheduler), which determines its lifetime.

If a parent exits and doesn't promote a task's frame, the task’s handle becomes invalid.

There is no implicit task registry, and no OS-level scheduler owns the memory — ownership is fully explicit and deterministic.

## **3. Tasks and Scheduling**

Tacit’s multitasking model is grounded in **cooperative concurrency**. It treats tasks as **user-space resumable functions**, executed in a round-robin loop with **explicit yield points**. There's no kernel or OS context-switching involved — just a linked list of task handles and a scheduler loop. This gives fine-grained control over execution and fits deeply into Tacit’s ownership-first philosophy.

### 3.1. **Tasks Are Resumables**

In Tacit, a task is nothing more than a **resumable function with persistent state** and a handle. When a task yields, it saves its execution point (via its `mainline` entry), and another task gets control.

Tasks:

* Retain their frame on the return stack.
* Have no private heap unless explicitly retained.
* Are suspended and resumed via the scheduler.

Because they’re just resumables, they obey all the same stack and promotion rules. There's no difference in structure between a stream processor, an event listener, or a coroutine — they’re all resumables under the hood.

### 3.2. **The Scheduler**

The scheduler is **just a loop** over a linked list of task handles. Each handle points to a saved frame and a resume entry. The scheduler:

* Loads the frame’s `bp`.
* Jumps to its `mainline`.
* Waits for a `yield`, which returns control and requeues the handle.

There’s no preemption, no thread IDs, and no kernel. All concurrency is **cooperative** — tasks must choose to yield. This keeps scheduling predictable and lightweight.

Handles can be added to or removed from the queue by any task, enabling dynamic launching or cancellation.

### 3.3. **Yielding**

`yield` in Tacit is **not** a function call. It’s an instruction that:

* Ends the current execution round.
* Transfers control to the next task in the list.
* Leaves the current frame and stack untouched.

It's **not necessarily exposed** to the user. Yielding can be implicit — for example:

* After N loop iterations.
* After a timeout (tracked via a clock task).
* After an IO stall (when a buffer is empty or full).

This means most code will **not explicitly mention** concurrency. The scheduler will handle preemption via policy-driven yields inserted at compile-time or by macros.

### 3.4. **Trampolines and Drivers**

In many cases, resumables are driven by **trampolines** — loops that resume them repeatedly:

```forth
: driver ( handle -- )
  begin dup resume? while dup resume drop repeat drop ;
```

But in a task system, the **scheduler itself is the trampoline**. Tasks don’t need to loop. They do one pass of processing and yield. This gives **bounded, cooperative scheduling** without requiring in-function loops.

That said, loops are still useful — especially when a resumable needs to filter, batch, or scan over input before yielding.

### 3.5. **Input Buffers and Message Passing**

Tasks communicate via **FIFO input buffers**, not the data stack. Buffers are:

* Decoupled from stack scope.
* Owned by the receiver.
* Readable in a non-blocking fashion.

If a task tries to `read` and the buffer is empty, it **yields automatically**. Likewise, if a task `write`s to a full buffer, it yields until the buffer is drained.

This turns IO into a natural scheduling point — no polling, no busy waiting. Tasks become reactive by default.

Each task can have:

* An **input buffer** (default FIFO queue).
* Optionally, an **output target** (another task’s buffer).
* Zero or more **auxiliary channels** for routing.

This builds a message-passing system that supports both:

* **Stream processing pipelines** (source → map → sink).
* **Event-driven actors** (react to messages, yield).

### 3.6. **Spawning Tasks**

Creating a task is just creating a resumable and **registering its handle** with the scheduler. You can:

* Spawn it inline with a handle promotion.
* Store it in a local registry.
* Pass it to other tasks.

The scheduler doesn’t care who owns the task — it only cares whether the handle is valid.

Tasks don’t run until resumed, and the scheduler resumes them in turn.

### 3.7. **Ownership and Lifetime**

Because all stack frames live on the ancestor’s return stack:

* Tasks can outlive their caller, but only if **promoted**.
* If a caller exits without promotion, its children are invalidated.
* There’s no automatic reference tracking — just scope.

This gives full predictability over task lifetime. No hidden references, no resource leaks.

Long-lived tasks can be managed via arenas or reference counting, but only if needed.

### 3.8. **Suspension and Inversion of Control**

The key feature enabled by this model is **inversion of control**. Any task can suspend when:

* It’s waiting on input.
* It’s rate-limited.
* It’s yielding after work is done.

This is **not async-await** — it’s more fundamental. All functions are async *by default* because:

* They can be resumables.
* They can yield at any point.
* They retain their local state without heap boxing.

There’s no distinction between “sync” and “async” code — just tasks that yield or don’t.

### 3.9. **Composability and Isolation**

Because each task owns its buffer and frame:

* Tasks don’t share state unless explicitly wired together.
* Side effects are explicit (sending, receiving).
* Parallel pipelines can run independently, even on a single-threaded VM.

This supports massive concurrency without complexity. Pipelines can:

* Process sensor data.
* Log to files.
* Handle CLI input.
* Control hardware peripherals.
* Run forever, or terminate cleanly.

All without threads, locks, or context switches.

## **4. Language Model and Syntax**

Tacit is designed from the ground up as a **minimal, stack-based, compositional language**, deeply inspired by Forth but reimagined for **asynchronous, ownership-based execution**. Its syntax is terse and regular, enabling both scripting and systems programming with the same primitives. Tacit draws on Reverse Polish Notation (RPN), point-free programming, and static memory models to achieve expressive power without symbolic overhead.

### 4.1. **RPN as Core Grammar**

Tacit programs are written in **postfix form**. All functions consume arguments from the data stack and leave results on it. This has profound implications:

* Function composition is **natural and free** — no need for parentheses or closures.
* Code is parsed and executed **linearly**, making it streamable and trivially tokenized.
* Expression trees are flattened — no precedence rules, no parsing ambiguity.

For example:

```tacit
3 4 + 2 *    \ is equivalent to (3 + 4) * 2
```

Function composition becomes:

```tacit
source map filter take print
```

Instead of calling functions on each other, we **pipeline** them through the stack.

### 4.2. **Point-Free and Argument-Free Style**

Tacit encourages **point-free programming** (functions defined without explicit arguments) by nature of its RPN and stack discipline. Rather than binding names to parameters, Tacit focuses on sequencing operations that transform the stack.

This enables:

* Function composition by simple juxtaposition.
* Avoiding variable juggling and bindings.
* Clear visual structure where operations are layered top-down.

Instead of writing `map(f, filter(g, xs))`, a Tacit sequence expresses this as `xs g filter f map`, without parentheses or boilerplate.

### 4.3. **Local Variables and Scope**

Tacit supports **local variables**, addressing a key weakness of classical Forth.

Locals:

* Live on the return stack above the base pointer.
* Are accessed by name with a `$` prefix.
* Are immutable after assignment.
* Can be promoted to parent scopes if needed.

This means stack juggling is avoided — you don’t need to `dup`, `swap`, `over` unless you're doing low-level tricks. The goal is to **eliminate most use of stack manipulation words** in high-level code.

Locals make code clearer, reduce bugs, and enable better optimization.

### 4.4. **Fields and Structs**

Tacit supports **structs** and field access via:

* `struct-def` for defining symbolic layouts.
* `struct` for instantiating local field blocks.
* `with` for scoping field access.

Fields are accessed using `%fieldname` within `with` blocks. There’s no heap allocation — fields are just memory slots with symbolic offsets. Field references are resolved statically during compilation.

Structs support **record-like behavior** without needing closures or heap-based objects.

### 4.5. **Words and Definitions**

All code in Tacit is made from **words**, which are macros or functions. Definitions:

* Use `:` to introduce new words.
* May define control structures, loops, arithmetic, or high-level pipelines.
* Can compile inline, static or dynamic behaviors.

Words are composable at all levels. There's no formal distinction between macros and functions — only in whether they expand at compile-time or runtime.

This makes metaprogramming natural: the language **extends itself** with almost no new syntax.

### 4.6. **Sequences and Pipelines**

Tacit’s signature abstraction is the **compiled sequence** — a chain of stages, each with its own `init` and `mainline`.

Pipelines:

* Are declarative but compiled into inlined code.
* Support streaming, lazy evaluation.
* Contain stages like `map`, `filter`, `take`, `zip`, `fork`, and `sink`.
* Are fully resumable — they can yield and resume transparently.

This turns ordinary programs into **asynchronous data processors** with very little boilerplate. Each stage is compiled into a mini state machine that cooperates with others through shared stack frames.

### 4.7. **Stack Discipline and Function Arity**

Functions in Tacit:

* Take fixed numbers of arguments.
* Leave fixed numbers of results.
* Are statically analyzable for stack effect.

This avoids surprises and encourages a **predictable style** of programming. There are no variadic functions. Everything composes clearly in a stack-based algebra.

Compiler checks ensure that sequences are well-formed and that stack effects match expectations. This gives a **type-like safety model** without needing a full type system.

### 4.8. **Syntax for Async and Yielding**

Tacit’s syntax has **no explicit async** keywords. Yielding is not part of the function interface — it’s a behavior inserted at compile-time or macro-expanded in loops and pipelines.

Most of the time:

* Functions run synchronously and return.
* If they contain implicit yield points, the scheduler will handle them.

This gives programmers **synchronous semantics** but with **asynchronous runtime behavior**. It avoids the complexity of async-await or promise-chains found in other languages.

### 4.9. **Interactive Shell and One-Liners**

Tacit is designed to be used like a **shell language**:

* One-liners work.
* Every command is a valid word sequence.
* You can build a program interactively, then persist it as a definition.

This aligns with Bash, but gives **much more power**:

* Real variables.
* Real functions.
* Real multitasking.

You can turn an interactive line into a named task, spawn it, compose it with others — all without switching modes or toolchains.

## **5. Ownership and Memory**

Tacit rejects garbage collection as both a performance hazard and a conceptual distraction. Instead, it embraces a model of **deterministic, ownership-based memory management**, which is simple enough to run on tiny machines but expressive enough to support composable, asynchronous, and resumable programs.

### 5.1. **No Garbage Collection**

Garbage collection is not forbidden — it’s just unnecessary. Tacit avoids it by ensuring:

* **Functions clean up after themselves**.
* **Reference counting**, when used, is bounded and optional.
* Most data has **stack lifetime**, not heap lifetime.

The goal is to make memory lifetime **explicit but effortless**.

### 5.2. **Stack-Centric Execution**

Tacit uses two main stacks:

* The **data stack**, a LIFO value queue.
* The **return stack**, which holds locals and control frames.

Locals are not heap-allocated. When a function returns, its locals are cleaned up. Promotion (discussed below) is the only way to extend lifetime.

This structure:

* Eliminates hidden lifetimes.
* Enables tail-call optimization and coroutine-like reuse.
* Supports efficient scheduling and task-switching.

Stack memory is fast, visible, and temporally scoped. This enables code to be **streamed, paused, resumed, and reasoned about** without memory overhead.

### 5.3. **Promotion**

Promotion is a controlled mechanism to extend the lifetime of local variables. It means:

* **Do not clean up the full return stack frame** on exit.
* Leave a portion of the frame intact, making it available to the parent or sibling resumables.

This allows one function to **create persistent state** for others:

* A child can promote part of its frame and then return.
* That frame remains live in the ancestor’s scope.
* Any other function that knows the frame layout can access the promoted state.

Promotion is **not visible symbolically**. The promoted variables are just stack cells. You need to know their layout to use them.

This is **an ownership transfer model**:

* Memory starts local to a function.
* It is promoted, thereby transferring ownership to the parent.
* The parent may ignore or delegate it.

### 5.4. **Handles and Resumables**

When a resumable function is initialized, it returns a **handle** — a tagged pointer representing the location of the saved base pointer. This handle:

* Refers to the frame.
* Allows the function to be resumed by jumping to its mainline entry.

Handles are not “objects” in the OO sense. They are **raw memory pointers** with a well-defined protocol. You don’t introspect them. You just resume them.

Handles are **lightweight and shareable**. Multiple handles can point to different resumables living in the same parent scope. This enables:

* Message passing.
* Multi-tasking.
* Stateful orchestration.

All without the need for heap allocation.

### 5.5. **Bump Allocation and Arenas**

Tacit supports a very simple form of heap allocation: **bump allocation**.

* A heap region is declared.
* Allocation is just a pointer increment.
* Deallocation is done by resetting the pointer.

This is extremely efficient, especially when paired with **arena allocation**:

* Allocate a whole scope or task into one arena.
* Deallocate it all at once when the task finishes.

Arenas are not garbage collected — they are explicitly owned, and ownership is transferred via promotion or cleared on scope exit.

This model:

* Makes allocation and deallocation **O(1)**.
* Avoids fragmentation.
* Keeps memory local and cache-friendly.

### 5.6. **Reference Counting (Optional)**

In cases where ownership must be shared — such as persistent sequences or buffers — Tacit allows **manual reference counting**:

* Increment the count when sharing.
* Decrement and free when done.

This is always explicit. There's no tracing collector, no runtime pause. You can build more sophisticated schemes on top if needed, but the base language avoids them.

Reference counting supports:

* Shared message buffers.
* Linked sequences.
* Long-lived pipelines.

But you use it only when the stack or arenas won’t do.

### 5.7. **No Closure Heap**

Tacit does not support closures in the conventional sense.

Instead:

* Functions are compiled with **static memory layout**.
* Any persistent state is made explicit via `struct` or promoted locals.
* Code is composed, not captured.

This means Tacit functions are **reentrant and stateless by default**, but **can manage state explicitly** without runtime allocation.

By contrast, Lisp-like closures hide memory behind symbols. Tacit exposes layout and lifetime in its compilation.

### 5.8. **Scripting Without Overhead**

Tacit aims to be a scripting language with **no toolchain and no garbage collection**:

* You can send source directly to a microcontroller.
* It compiles on target.
* There’s no memory overhead for object graphs or lexical environments.

This enables truly low-cost computing — the ability to script on a five-cent chip — which modern scripting languages can’t touch.

## **6. Resumable Functions and Coroutines**

Tacit uses **resumable functions** as its core abstraction for cooperative multitasking, lightweight threads, pipelines, and staged execution. These are not high-level coroutines in the Python or JavaScript sense. They are **low-level, explicitly structured stack frames** with clear calling conventions and well-defined scope behavior.

### 6.1. **Two Entry Points: Init and Mainline**

Each resumable function has two distinct entry points:

* **Init phase**: runs once to allocate and initialize state.
* **Mainline phase**: re-enters repeatedly to perform work.

The init phase returns a **handle**, which contains a saved base pointer (BP) and a fixed code address. This handle is placed on the data stack and passed around like a capability.

The mainline phase resumes execution at a known offset. It uses the same frame, so the state is preserved across yields.

### 6.2. **Frame Layout and Stack Protocol**

A resumable frame lives on the return stack:

* `BP` marks the base of the frame.
* The init phase pushes local variables above `BP`.
* The mainline reuses those locals directly.

There is **no heap**, no closure context, no capture of outer variables. The return stack is the frame. If state must persist, it lives on that frame — possibly as a promoted segment.

This makes resumables cheap, transparent, and nestable. They’re just structured uses of the return stack with saved BPs.

### 6.3. **Promotion and Scope Extension**

Resumables can promote part of their frame:

* Instead of restoring the return stack to its pre-call position, they **leave a slice of locals intact**.
* This slice becomes part of the parent scope.
* Other resumables can reference this data, provided they know its layout.

Promotion is **not symbolic**, not dynamic, and not introspective. It is layout-based. The compiler determines offsets; the runtime just preserves them.

This enables:

* One-shot state promotion (e.g. child sets up state, then exits).
* Multi-resumable environments, where many tasks share ancestor memory.
* Asynchronous handoffs, where one task writes and another reads from shared memory.

### 6.4. **Yield and Cooperative Scheduling**

Tacit uses **explicit yield** to implement cooperative multitasking:

* When a task yields, it saves no CPU state — just exits voluntarily.
* The scheduler jumps to the next runnable task in a circular list.

Yielding doesn't require heap storage, closures, or callbacks. It just hands off control. The yield instruction can be implicit (inserted by compiler in loops) or explicit (for advanced control).

This makes it possible to:

* Write asynchronous code **without callbacks**.
* Suspend and resume pipelines naturally.
* Break out of tight loops to preserve responsiveness.

### 6.5. **Trampolines and Drivers**

In many cases, resumables are driven by a **trampoline**:

* A top-level loop repeatedly resumes them.
* Each call to mainline does one unit of work and returns.

This allows resumables to be **pure state machines** — they don’t loop internally. They execute one step per resume, and exit. The trampoline handles iteration.

This separation of concerns means you can:

* Compose pipelines from tiny stages.
* Replace internal loops with externally managed flow control.
* Chain, fan out, or zip resumables without hidden control flow.

### 6.6. **No Parent Awareness, No Hierarchies**

Resumables **do not know who created them**. There is no object hierarchy. Promotion leaves state in the ancestor scope, but there’s no enforced structure.

This allows:

* Peer-to-peer cooperation between tasks.
* Stateless parent functions that launch and forget.
* Flat scope, where all tasks live in the same logical frame.

Ownership is **shared by agreement**, not by reference. A task can know about another by holding its handle or knowing the memory layout of its promoted state. Nothing more.

This makes the system more flexible — but also demands discipline. Tasks must not trample memory they don’t own.

### 6.7. **Resumables as Tasks**

A task in Tacit is just a resumable with a handle in the scheduler:

* It runs its mainline phase.
* It yields at appropriate points (e.g. after reading input, or failing to write output).
* The task manager loops through the task list, jumping to each active handle.

No special syntax is needed. No preemption, no kernel. Just a linked list of resumables, each with state and a resume point.

Because everything is explicit:

* You can schedule tasks dynamically.
* You can drop, delay, or prioritize tasks.
* You can pause on input, buffer on output, or synchronize on message channels.

All without threads, OS calls, or stack switching.

### 6.8. **Loop Yielding Policy**

Resumables should not yield on every loop iteration. Instead:

* A compiler directive can insert yield after N iterations.
* Or yield after X microseconds have passed.
* Or on a conditional basis (e.g. I/O blocking).

This balances performance with fairness. Short tasks run fast. Long tasks yield to avoid starving others.

The programmer **need not insert yield manually** unless doing something advanced. Most yield behavior is tied to structure: loops, pipelines, queues, etc.

### 6.9. **Default Asynchronous Semantics**

Tacit makes **asynchronous behavior the default**:

* Pipelines naturally suspend between stages.
* Tasks pause when blocked.
* Functions can return handles for later resumption.

This encourages a **dataflow model**, where values pass between cooperating stages and tasks synchronize via shared arenas or promoted state.

It also removes the distinction between "synchronous code" and "async code". Everything is resumable. Every function can become a coroutine without rewriting.

## **7. Composition, Streams, and Declarative Pipelines**

Tacit emphasizes **composition-first programming**, using a model that favors chaining small operations into powerful pipelines. This model builds on stack-based execution, sequence stages, and the ability to treat functions as data-processing steps. It replaces traditional control flow with stream-oriented declarativity.

### 7.1. **Point-Free Composition**

Tacit supports **point-free programming** (functions defined without explicit arguments) by nature of its RPN and stack discipline. Rather than binding names to parameters, Tacit focuses on sequencing operations that transform the stack.

This enables:

* Function composition by simple juxtaposition.
* Avoiding variable juggling and bindings.
* Clear visual structure where operations are layered top-down.

Instead of writing `map(f, filter(g, xs))`, a Tacit sequence expresses this as `xs g filter f map`, without parentheses or boilerplate.

### 7.2. **Pipelines as First-Class Constructs**

Pipelines in Tacit are sequences of resumables or compiled stages:

* A **source** generates values.
* A **transform** stage modifies them.
* A **sink** consumes or forwards them.

Each stage is a function or resumable. Composition is just stacking these up, with each one passing values to the next. There's no need to manage loops or callbacks; the entire structure is lazy and pull-based.

For example:

* A file source produces bytes.
* A decoder stage converts them to strings.
* A parser builds data structures.
* A consumer logs or reacts.

This looks like: `source decode parse consume`, a clean and minimal chain.

### 7.3. **Streams and Lazy Evaluation**

Each pipeline stage is **lazy** and **resumable**. A stage only executes when the next stage pulls a value. This means:

* Work is deferred until needed.
* Backpressure is automatic: no value is produced unless consumed.
* Tasks can yield naturally if they block or wait on input.

This model is ideal for real-time systems and embedded processing, where memory and CPU are tight.

Because stages are resumable, they:

* Maintain internal state across calls.
* Do not reinitialize each time.
* Can be compiled to tight loops or interleaved code blocks.

### 7.4. **Bash-Like One-Liner Semantics**

Tacit is designed to **replace Bash** for many scripting scenarios:

* Each command line is a complete pipeline.
* RPN and stack semantics match the way Unix pipes work.
* Scripts are compact and readable without sacrificing power.

A Tacit one-liner like `read-lines trim map log` is more expressive than its Bash counterpart, avoids subprocess overhead, and can be compiled or interpreted natively.

### 7.5. **Streamability and Serialization**

Because Tacit’s evaluation model is linear and execution is immediate:

* Tacit programs are inherently **streamable**.
* They can begin executing before the full source is loaded.
* This makes them ideal for master-slave communication, over serial links or TCP.

Inspired by PostScript and early dataflow languages, this allows Tacit to:

* Serve as a transport format.
* Be transmitted as a stream of commands.
* Process data as it arrives, in-place, without buffering the entire program.

This is useful for constrained environments — printers, plotters, IoT devices — where incremental execution is essential.

### 7.6. **Structured Sequences and Macros**

Tacit supports **macro expansion of pipelines**:

* A macro like `range map zip take` expands into compiled interleaved blocks.
* `init` and `mainline` phases of each stage are compiled in sequence.
* Patch stacks handle forward references and back-linking between stages.

This gives the feel of a high-level declarative language, but compiles down to **linear, inlined, minimal bytecode**.

Macros aren’t runtime features. They’re compile-time scaffolding for generating efficient code structures from high-level patterns.

### 7.7. **Avoiding Stack Juggling**

While Tacit supports stack operations (`dup`, `swap`, etc.), their use is minimized:

* Locals replace most juggling needs.
* Sequences avoid deep nesting or reordering.
* Stack shuffling is a **failure mode**, not a standard practice.

The goal is to express logic without shuffling state manually. This reduces cognitive load and makes sequences more readable.

In well-formed code, `swap` is rare; `over`, `rot`, and `pick` are even rarer. This reflects a discipline, not a restriction — the language enables clean abstraction, and avoids the common traps of Forth-like systems.

### 7.8. **Asynchronous by Default**

Each pipeline stage is resumable and capable of yielding. This means:

* Pipelines are asynchronous without needing futures, promises, or async/await.
* A stage that can’t continue just yields and waits for data.
* Control flow is cooperative, not preemptive.

This removes the need for event loops or callbacks. Pipelines behave like Unix processes: they do their job, yield when blocked, and resume when needed.

## **8. Minimal Runtime and Ownership-Based Memory**

Tacit is designed to run on **minimal hardware**, with an emphasis on predictable, low-overhead execution. It avoids garbage collection entirely by embracing **ownership**, **stack discipline**, and **arena allocation**. The result is a language that can operate efficiently even on constrained systems like microcontrollers, while still supporting high-level abstractions.

### 8.1. **No Garbage Collection**

Garbage collection is not assumed. Instead, Tacit:

* Uses **reference counting** for dynamic memory when needed.
* Relies on **stack allocation** for most transient values.
* Encourages **linear ownership flow**, where data is passed and consumed rather than copied or retained.

By avoiding GC, Tacit sidesteps the unpredictability, latency, and memory overhead common in functional and object-oriented runtimes. This is especially critical in embedded environments or real-time systems.

### 8.2. **Arenas and Bump Allocation**

Tacit supports simple **arena-style memory management**:

* Memory is allocated from a preallocated block (arena) using a bump pointer.
* No per-object free calls are needed.
* Cleanup is done by resetting the pointer or discarding the entire arena.

This works well for:

* Short-lived allocations.
* Structured lifetimes (e.g., scratch space for compilation).
* Resumables that use frame-local storage without lingering references.

Arenas are suitable for tree-like workloads, where all nodes can be discarded at once.

### 8.3. **Reference Counting for Heap Objects**

When allocation is necessary, Tacit uses **reference-counted heap blocks**:

* Each heap block has a header with a type tag and a count.
* When a block is pushed or assigned, the count is incremented.
* When a scope exits, reference counts are decremented.
* If the count hits zero, the block is freed immediately.

This avoids tracing GC and fits Tacit’s ownership philosophy: the **caller owns all allocations**, and frames clean up only what they create.

It also works well with the stack discipline — values aren’t retained unless explicitly promoted.

### 8.4. **Stack-First Execution Model**

Tacit puts the **return stack** at the center of execution. Unlike many Forth derivatives, Tacit gives it structural priority:

* Locals are stored on the return stack.
* Functions clean up their locals unless promoted.
* Resumables extend their parent’s stack frame, keeping everything linear.

This allows tight control over lifetime and memory — stack frames are **naturally scoped**, and data lives only as long as the frame that created it.

Unlike heap-oriented languages (Lisp, Python), which assume arbitrary retention and sharing, Tacit requires **explicit promotion** of values across scopes.

### 8.5. **Promotion as Lifetime Control**

Promotion is Tacit’s mechanism for **transferring ownership**:

* Normally, a function clears its local stack on exit.
* If it promotes one or more locals, it adjusts the return pointer and leaves them in place.
* These promoted values become part of the parent’s scope.

This enables:

* Safe construction of resumables from child frames.
* Creation of asynchronous tasks without heap allocation.
* Return of handles to long-lived state machines.

Promotion is not symbolic — parents don’t see the names of promoted values. It’s structural. The stack simply **grows downward**, and promoted values are retained.

### 8.6. **Closures Without Garbage**

Tacit supports **closure-like behavior** without actual closures:

* Functions can promote their environment to the parent.
* Handles returned by functions can reenter that environment.
* There’s no need to capture scope or manage heaps.

This approach avoids the classic trap of closures in GC languages — dangling references, retention leaks, or overly conservative lifetimes.

In Tacit, everything is **owned**, **stack-local**, and **discardable** by default.

### 8.7. **Suitable for Embedded and Low-Power Devices**

Tacit’s runtime is small enough to run on:

* AVR microcontrollers (e.g., Arduino).
* RISC-V chips.
* Cortex-M series.
* ESP32 and similar SoCs.

It needs:

* A few kilobytes of RAM.
* A simple VM (a few hundred bytes).
* An arena or heap region (optional).

Unlike Python or JavaScript, Tacit:

* Doesn’t require garbage collection.
* Doesn’t require complex toolchains.
* Can interpret or compile code in-place.

This makes it ideal for **direct deployment**, scripting on-device, and interacting with hardware in a deterministic way.

## **9. Asynchronous Execution and Cooperative Multitasking**

Tacit supports **asynchronous programming** by default, using a **cooperative multitasking model** based on resumable functions, yield points, and a round-robin scheduler. Rather than relying on system threads or interrupts, Tacit treats each task as a **resumable coroutine** that can pause, yield, and resume as needed.

### 9.1. **Resumables as Tasks**

Every resumable function can act as a task:

* It has two entry points: `init` (first call) and `mainline` (resumed call).
* A **handle** returned from `init` represents the resumable’s stack frame.
* That handle can be scheduled and resumed repeatedly.

Resumables encapsulate state across pauses, enabling long-running or event-driven processes without heap-based closures.

Each resumable:

* Lives on the return stack.
* Is promoted explicitly to survive scope exit.
* Owns its frame and local state.

### 9.2. **Yield as a Scheduling Hint**

Tacit includes the concept of `yield`, which signals that a task wants to give up control.

Yield:

* Is not a function call — it's a control transfer.
* Does not resume from the same place automatically.
* Simply **returns control to the scheduler**, which then picks the next task.

Yielding is **cooperative**:

* There is no preemption.
* A task must yield voluntarily.
* This allows predictable, low-latency scheduling without complex locking.

### 9.3. **Scheduling and the Task Queue**

Tasks live in a **circular linked list**, the task queue. The scheduler walks the list:

* It invokes each task by resuming its handle.
* The task runs until it yields or completes.
* On yield, control returns to the scheduler.
* If the task is still active, it remains in the queue.

This model is simple, efficient, and deterministic.

Typical usage:

* Tasks yield if they’re blocked on input or output.
* CPU-bound tasks yield periodically (e.g., every thousand iterations).
* System timers or events can schedule new tasks or wake sleeping ones.

### 9.4. **Looping and Resumables**

By default, resumables run to completion — they don’t loop.

Looping is achieved externally via a **trampoline**:

* A function that repeatedly resumes the same handle.
* It mimics a `while` or `for` loop at the task manager level.
* Internally, loops can yield mid-way using policies (e.g., after N steps).

This keeps resumables **short and cooperative** — they run a single pass and yield.

### 9.5. **Automatic Yield Points**

In Tacit, the `yield` is typically **implicit** and policy-driven:

* Loops may yield every N iterations.
* Long functions may yield after a timer threshold.
* The user can override the yield policy, but usually doesn't need to.

This removes the burden of manual scheduling:

* Developers write normal code.
* The runtime inserts yield points where needed.
* Tasks don’t lock up the system accidentally.

Yield is a low-level control word, not part of high-level programming — it's an advanced feature, not normally exposed.

### 9.6. **Suspension and Backpressure**

One of Tacit’s key strengths is **backpressure-aware tasks**.

If a task:

* Can’t read from its input buffer,
* Or can’t write to its output buffer,
  Then it **yields automatically**, suspending until the condition changes.

This allows:

* Streaming pipelines where slow consumers stall producers.
* Message-based systems where input starvation causes sleep.
* Event-based systems where tasks only run when triggered.

It’s all done cooperatively — no polling, no busy-waiting.

### 9.7. **Message Passing and Communication**

Tasks communicate via **FIFO input buffers**, not shared memory.

Each task has:

* An **input buffer** it reads from.
* Possibly an **output buffer** it writes to (which may be another task’s input).

This models:

* UNIX-style pipelines (stdin/stdout).
* Actor-style messaging.
* Event queues and stream processors.

Because buffers are FIFO and owned, there’s no need for locking or reference semantics.

### 9.8. **Asynchronous by Default**

Tacit programs are asynchronous **by default**:

* Every function is resumable.
* Every task is cooperative.
* Every buffer is message-based.

There’s no difference between synchronous and asynchronous code. Yielding is just part of the flow — the runtime takes care of fairness.

This avoids the complexity of callback hell, promise chaining, or reactive systems.

### 9.9. **No Preemption, No Locks**

Because all multitasking is cooperative:

* There is **no preemption**.
* There are **no locks** or mutexes.
* There’s no race condition unless code explicitly shares state.

This makes Tacit ideal for:

* Embedded systems.
* Real-time applications.
* Simulation engines.
* High-concurrency with zero contention.

## **10. Interprocess Communication and Stream Abstractions**

Tacit models all communication between tasks and processes using **streaming abstractions** built around message-passing, input/output buffers, and cooperative suspension. These facilities form the backbone of its concurrency model, and draw from both UNIX pipes and actor-style design — but are built natively into the language semantics.

### 10.1. **Input and Output Buffers**

Each task in Tacit may have:

* A **FIFO input buffer**, from which it reads values.
* One or more **output buffers**, which it can write to (typically connected to other tasks’ inputs).

These are:

* Ordered.
* Streamed.
* Non-blocking in semantics but **blocking in scheduling**: if a task can’t write or read, it yields.

This allows:

* Pipelines to be assembled declaratively.
* Task-to-task communication without shared memory.
* Decoupling between producer and consumer rates.

### 10.2. **Suspension on I/O Pressure**

If a task attempts to:

* Write to a full output buffer,
* Or read from an empty input buffer,

Then it **yields automatically**. This prevents busy-waiting, allows **backpressure**, and ensures that the entire pipeline remains balanced.

This behavior is deeply embedded in the semantics of Tacit: suspension is not an exception — it’s the default response to unavailable resources.

### 10.3. **Standard Streams**

Tacit environments include **standard input/output streams** by default:

* `stdin`: connected to terminal, pipe, or data source.
* `stdout`: printed, logged, or forwarded.

These are implemented as buffers, not files:

* They support stream semantics, not random access.
* They can be redirected to other tasks or devices.
* They fit cleanly into the pipeline model.

This means `source -> transform -> sink` is the fundamental programming idiom — just like in Bash, but much more powerful and embedded.

### 10.4. **Assembling Pipelines**

Processes can be wired together using buffer links:

* A process’s output is another’s input.
* Multiple producers can write to a shared buffer.
* Tasks can act as filters, sinks, or routers.

This makes building pipelines feel like **connecting nodes** in a graph:

* Stateless filters just transform streams.
* Stateful processors can maintain context.
* Side-effecting tasks can interact with hardware, filesystems, or time.

Tacit provides syntactic sugar and macros for expressing these connections concisely.

### 10.5. **Backpressure and Flow Control**

Backpressure is automatic and implicit:

* Slow consumers cause upstream producers to yield.
* Fast producers naturally get throttled.
* Tasks only run when their input is ready and output is available.

There’s no need for semaphores, flow control protocols, or handshaking — the FIFO model and cooperative multitasking handles it.

### 10.6. **Timers and External Events**

Some tasks are driven by **timers or external events** rather than inputs:

* A clock task can emit timestamps or schedule events.
* An event task can receive hardware interrupts or I/O changes.
* These inject messages into the system and wake suspended processes.

Tacit treats time as just another stream source.

For example:

* A debounce task watches GPIO input.
* A timeout task suspends until a duration passes.
* A cron task emits messages on a schedule.

These integrate with other tasks naturally — they can be treated like any other message source.

### 10.7. **Isolation and Ownership**

Each task:

* Owns its buffers.
* Cannot access another’s state directly.
* Communicates only via explicitly connected streams.

This enforces **strong isolation** and supports **ownership-based concurrency**:

* There is no shared mutable state.
* No aliasing or borrowing.
* No accidental data races.

It also simplifies debugging, scheduling, and reasoning about control flow.

### 10.8. **Composability and Stream Reuse**

Because streams are just values:

* You can pass them to functions.
* You can store them in structs.
* You can duplicate them or fork streams.

This enables higher-order streaming constructs:

* Broadcast a stream to many consumers.
* Merge streams.
* Transform one stream into another.

This aligns Tacit more closely with **functional stream processing**, but implemented with imperative performance.

## **11. Language Philosophy and Design Principles**

Tacit is built not as an evolution of existing high-level languages, but as a counterpoint — a return to fundamentals, designed for clarity, control, and expressive power. Its core principles are rooted in low-level efficiency, stack-centric design, and first-class support for asynchronous, cooperative execution.

### 11.1. **Imperative, But Composable**

Tacit embraces imperative execution, but without sacrificing composability. Unlike traditional imperative languages, Tacit:

* Encourages **point-free**, stack-based programming.
* Avoids named arguments or symbolic variables where possible.
* Builds function composition into the language through Reverse Polish Notation (RPN).

This gives it a feel of **functional composition with imperative semantics**, where control flow and dataflow are explicit and linear.

### 11.2. **Minimal Toolchain, Maximal Control**

Tacit is designed to run:

* Without a heavyweight compiler.
* Without a garbage collector.
* Without runtime type introspection.

Instead:

* It uses a compact interpreter or JIT-friendly VM.
* It supports stack-based lifetime management, optional heap via arenas, and explicit resource ownership.
* It encourages embedding, bootstrapping, and metaprogramming without layers of complexity.

It can be deployed and run on tiny devices like microcontrollers, with no need for servers, runtimes, or dev environments.

### 11.3. **Stack-Oriented Execution**

Tacit is fundamentally a **dual-stack language**:

* The **data stack** is used for arguments, computation, and local shuffling.
* The **return stack** is used for control flow, local variables, and persistent state.

Locals are allocated on the return stack in a frame managed by the function. Persistent state (as in resumables) is simply **retained portions of the return stack**.

This model allows:

* Cheap context switching.
* Predictable memory behavior.
* Avoidance of heap allocation for most workflows.

The return stack becomes a **first-class memory model** — not just for returning from calls, but for structuring the lifetime of data.

### 11.4. **Cooperative Multitasking, Not Preemption**

Tacit programs are asynchronous by default. The scheduler is cooperative:

* Tasks yield voluntarily — on I/O waits, full buffers, or periodic loop checkpoints.
* There's no preemption, locking, or concurrency bugs.
* Resumables represent paused computations, resumable from the exact point they left off.

This model enables:

* Deterministic scheduling.
* No need for threads or OS support.
* Real-time safe execution.

It feels more like **event loops or trampolines**, but with stack-managed coroutines and natural sequencing.

### 11.5. **Explicit Ownership, Avoiding GC**

Tacit leans toward **Rust-like ownership** rather than garbage collection:

* Stack values are cleaned up deterministically.
* Heap allocations are rare and scoped using arenas or reference-counted regions.
* Promotion and demotion of stack frames allows flexible scope extension.

There is no global collector, no scanning, no pause times. This makes Tacit suitable for hard real-time and low-resource environments.

### 11.6. **Resumables Instead of Closures**

Rather than using closures with captured environments and heap-allocated frames, Tacit uses:

* **Resumable functions**, which maintain state on the return stack.
* **Handles**, which can resume paused code in-place.

This avoids:

* Hidden allocations.
* Opaque control flow.
* Symbolic variable lookup.

The system encourages **structured concurrency**, where task lifetimes and ownership are visible and controllable.

### 11.7. **Structured Syntax, Not Symbolic Programming**

Tacit is **not** Lisp, and deliberately avoids its symbolic metaprogramming model. Instead:

* Syntax is simple, literal, and positional.
* Macros exist, but are implemented as code generators rather than symbolic transformers.
* The language is **interpretable and compilable** with minimal overhead.

This supports:

* Easier bootstrapping.
* Self-hosting compilers.
* Efficient parsing and streamability.

Tacit programs can be **sent as streams, parsed incrementally, and executed immediately** — ideal for embedded and distributed systems.

### 11.8. **Single-Pass, Line-Based Thinking**

Inspired by Bash, Tacit encourages:

* Small, composable command-line programs.
* Stream processing with minimal ceremony.
* Declarative pipelines built from minimal pieces.

It avoids:

* Deep nesting.
* Long dependency chains.
* Boilerplate-heavy configuration.

The goal is to **get things done quickly**, with maximum power per line of code.

### 11.9. **Low-Level Roots, High-Level Power**

Tacit is ultimately:

* A **modern Forth**, reimagined.
* A toolkit for building interpreters, pipelines, and systems from the ground up.
* A scriptable shell, a language, and a VM — all in one.

It targets:

* Tiny embedded CPUs.
* Local scripting environments.
* Minimalist high-performance systems.

Its biggest philosophical aim is to **rediscover lost possibilities** from early computing — lightweight, declarative, expressive systems that are close to the metal, without being enslaved by it.

## **12. Target Platforms and Deployment Models**

Tacit is designed with an emphasis on **hardware affinity**, not just software convenience. Unlike languages designed purely for the cloud or desktop, Tacit is made to run directly on hardware with minimal layers. It treats both scripting and system control as first-class use cases.

### 12.1. **Microcontroller First**

Tacit targets **resource-constrained environments** like:

* **Arduino-class 8-bit microcontrollers**, which have kilobytes of RAM and no OS.
* **ESP32 and ARM Cortex-M systems**, with more power but still tight memory budgets.
* Automotive or appliance CPUs costing a few cents.

Key features enabling this include:

* No garbage collector.
* Optional heap; stack-first model.
* Small interpreter or JIT core with minimal memory overhead.
* Cooperative multitasking that avoids preemption or threading libraries.

Unlike Python or JavaScript, Tacit can fit in these systems **without needing a full OS, runtime, or toolchain**.

### 12.2. **Interpreter-Driven Deployment**

Tacit favors **interpreted or tokenized bytecode** deployment. Its code is designed to:

* Be streamable, like PostScript or shell pipelines.
* Be loaded dynamically from flash, serial ports, or network buffers.
* Execute as it is read, avoiding large up-front parsing phases.

This supports:

* Live system reconfiguration.
* Remote programming of IoT devices.
* Plug-and-play scripting of hardware peripherals.

Tacit behaves more like a **command stream for a virtual CPU** than a compiled binary for a static one.

### 12.3. **Self-Hosting Potential**

Tacit is simple enough to **compile itself** on target hardware. This opens the door to:

* Self-contained firmware that includes its own compiler.
* Local compilation from high-level source code to bytecode or direct VM opcodes.
* Building metacompilers and language extensions directly on device.

This makes Tacit ideal for:

* Teaching environments where students build the whole stack.
* Hobbyist development without cross-compilation.
* Systems with **no external build tooling**.

### 12.4. **Alternative to Unix Shells**

Tacit is a serious candidate to replace **Bash, Awk, and shell scripts** on embedded or server systems. Its benefits include:

* Better syntax for structured pipelines.
* Proper local variables and stack discipline.
* Reusable, composable sequences instead of line-by-line imperative logic.
* Consistent asynchronous behavior.

A Tacit script is **shorter, clearer, and easier to reason about** than Bash or Python in many cases. And it scales better to interactive and stream-based usage.

### 12.5. **JIT or AOT Compilation for Power Users**

Although Tacit can be interpreted, its design supports:

* **JIT compilation** to native machine code from a token stream.
* **AOT compilation** into efficient low-level code for shipping firmware.

Its stack-oriented nature translates easily to:

* Register allocation for fast code paths.
* Fixed instruction sequences for loops and arithmetic.
* Inlined state machines for sequence processing.

For performance-critical deployment, Tacit can be **compiled to rival C in efficiency**, without sacrificing its stack semantics.

### 12.6. **Streaming and Serialization Targets**

Because Tacit execution mirrors the order of source code, it is naturally **streamable**:

* It can start executing code before it finishes receiving it.
* It can act as both sender and receiver of serialized instruction streams.
* It supports **master-slave device protocols**, where low-latency execution matters.

This makes it ideal for:

* Network-controlled sensors and devices.
* Peripheral firmware that must process structured commands quickly.
* Distributed processing with little RAM or CPU overhead.

Unlike Lisp or JSON-based interpreters, Tacit avoids symbolic overhead and complex AST traversal. It's **syntax-free beyond the token level**.

## **13. Design Goals and Tradeoffs**

Tacit is a language built around the principle that **simplicity and raw control** matter more than high-level convenience. Every feature reflects a deliberate tradeoff between expressive power, system constraints, and the programmer’s mental model. The design favors **imperative code generation, stack discipline, and low-overhead abstraction**.

### 13.1. **No Garbage Collection**

Garbage collection is deliberately avoided. Tacit leans on:

* **Stack-based lifetimes** for most variables.
* **Resumable functions** that explicitly control their own scope and cleanup.
* **Manual heap use**, often through reference-counted or bump-allocated arenas.

The tradeoff: programmers or macro authors must be explicit about resource ownership. But this enables execution on microcontrollers, real-time systems, and soft real-time shells without pause-the-world latency.

### 13.2. **Resumables Over Threads**

Tacit avoids full threading or preemptive multitasking in favor of **cooperative multitasking** via resumables. This enables:

* Fully deterministic execution.
* Stack ownership and cleanup guarantees.
* No shared-memory races or reentrancy bugs.

The tradeoff: long-running tasks must yield manually, or via policy hooks in loops and IO. This is more predictable than thread-based concurrency but less automatic.

### 13.3. **Stack-First Model**

Both control and data are passed via **explicit stacks**:

* The **data stack** for transient computation.
* The **return stack** (or locals stack) for scoped storage and function state.

Local variables exist but are **allocated in frame-like structures** on the return stack. This promotes compact code with low memory churn.

The tradeoff: complex operations require planning around stack effects. Tacit programs are most effective when written point-free or in small chunks.

### 13.4. **Composition Without Syntax**

Tacit strongly favors **RPN (reverse Polish notation)** and **point-free style**, enabling composition of sequences without syntax trees:

* Pipelines are built by writing processing words in sequence.
* Sequences are composed without parentheses, braces, or argument names.
* Control flow is encoded structurally, using blocks and macros rather than keywords.

The tradeoff: Tacit is alien to programmers used to infix syntax and named parameters. But once internalized, its code is terse and highly expressive.

### 13.5. **Macro-First Language Core**

Rather than treating macros as a convenience, Tacit **elevates macro expansion to a primary mechanism** for abstraction:

* Pipelines are expanded into state-machine-like code blocks.
* Constructs like `for-each`, `map`, and `filter` are not built-in — they’re macros.
* The compiler emits **flattened, inlined code**, not runtime-constructed closures.

The tradeoff: writing new abstractions may require metaprogramming skills. But it avoids runtime cost entirely.

### 13.6. **Minimal Toolchain and Self-Contained Execution**

Tacit can be compiled and interpreted using a **minimal toolchain**, or even self-hosted. The language was designed with the assumption that:

* Compilation can happen on the target device.
* Interpretation is lightweight and fast.
* Source and executable forms are nearly the same.

This means a Tacit system can run from ROM, boot into an interpreter, and receive programs via serial or network without external tooling.

### 13.7. **Imperative Core, Declarative Extensions**

Tacit is fundamentally **imperative**, but it supports **declarative composition** through sequences, macros, and stack-friendly combinators. This creates an unusual mix:

* You write high-level compositions in a declarative, functional style.
* The result is compiled into raw stack-manipulating imperative code.

The tradeoff: the programmer must know where the abstraction ends. Tacit offers no illusions of purity, but gives you tools to control execution precisely.

## **14. Comparison with Other Languages**

Tacit sits in a rare design space: a modern, programmable stack machine language focused on low overhead, composability, and cooperative multitasking. Its design choices contrast sharply with both traditional high-level languages and established low-level systems.

### 14.1. **Forth**

Tacit owes a clear debt to Forth in its use of dual stacks, direct execution, and postfix notation. But it diverges in key areas:

* **Resumable functions** add structured coroutine-style control flow that Forth lacks.
* **Locals and BP frames** provide predictable, stack-based variable access — unlike Forth’s implicit and hard-to-manage return stack tricks.
* **Structured macros and compilation targets** replace Forth’s reliance on interpreter metaprogramming.

Tacit takes Forth’s essence — immediacy, composition, and self-hostability — and rebuilds it with modern needs in mind: coroutine logic, structured memory, and safe concurrency.

### 14.2. **Lisp / Scheme**

Tacit shares Lisp’s goal of being a programmable programming language. But the philosophies diverge sharply:

* Lisp uses **symbolic structures and trees**; Tacit uses **concrete sequences and stacks**.
* Lisp leans on **heap allocation and garbage collection**; Tacit uses **scoped stacks and arenas**.
* Lisp favors **closures and recursion**; Tacit prefers **resumables and loops**.

In short, Lisp encodes structure in symbols and runtime manipulation. Tacit encodes behavior in execution context and control flow. Lisp is great for meta-coding; Tacit is great for bare-metal control.

### 14.3. **C**

C is often considered the lowest-level portable systems language. But compared to Tacit:

* C relies on **manual memory and flat functions**; Tacit offers **stack-local state and managed scopes**.
* C’s control flow is **structured but limited**; Tacit supports **fine-grained yielding and resumables**.
* C emphasizes **explicit heap and pointer manipulation**; Tacit emphasizes **stack management and message-passing**.

Tacit is lower-level in some ways (closer to the control model), but higher-level in its support for sequences, coroutines, and program composition.

### 14.4. **Rust**

Rust and Tacit share a commitment to **ownership, determinism, and no garbage collection**. But their tradeoffs are different:

* Rust enforces **borrow checking at compile time**; Tacit uses **stack lifetimes and manual promotion**.
* Rust is **type-heavy and syntax-rich**; Tacit is **type-minimal and syntax-light**.
* Rust supports **safe concurrency via the type system**; Tacit uses **cooperative multitasking and message buffers**.

Rust optimizes for correctness on large systems. Tacit optimizes for simplicity on small ones.

### 14.5. **Python / JavaScript**

Tacit is a direct critique of languages like Python and JavaScript in scripting and glue-code domains:

* Python and JS have **high runtime overhead**, even for small programs; Tacit is immediate and tiny.
* They rely on **heavyweight garbage collection and dynamic scoping**; Tacit uses **precise control and static frames**.
* They require **significant tooling, interpreters, and resources**; Tacit runs in kilobytes.

While Python and JS are great for developer productivity, Tacit enables a different kind of productivity — closer to the metal, real-time, compositional, and scalable down to hardware constraints.

## **15. Use Cases and Application Domains**

Tacit is designed not as a general-purpose language for all use cases, but as a **strategic tool** for certain environments where its strengths — stack discipline, cooperative multitasking, and zero-overhead abstractions — shine. Its value increases precisely where conventional languages struggle: **low-resource environments**, **tight feedback loops**, and **compositional control flow**.

### 15.1. **Microcontrollers and Embedded Systems**

Tacit thrives in low-resource hardware environments, including 8-bit, 16-bit, and small 32-bit MCUs like AVR, RISC-V, ARM Cortex-M, and ESP32.

* **Tiny footprint:** No GC, no runtime metadata, no dynamic linker — Tacit can fit in tens of kilobytes.
* **No heap required:** Its arena and stack-based memory model avoids fragmentation and GC pauses.
* **Task-driven concurrency:** Cooperative multitasking lets multiple behaviors run predictably without OS-level threads or preemption.
* **Real-time control:** You can yield between tight loops, handle IO events deterministically, and write interrupt-resilient code.

Tacit competes with C and Rust in this space — but with simpler deployment, better interactive feedback, and fewer toolchain dependencies.

### 15.2. **Scripting and Shell Replacement**

Tacit is explicitly designed to be a **Bash-style replacement**, emphasizing RPN composition, pipelines, and one-shot scripting.

* **Postfix pipelines** like `source filter sink` naturally resemble shell syntax, but with full structured control flow.
* **Lightweight interpreters** allow embedding Tacit on servers, remote devices, and containers without heavy shells or runtimes.
* **Compositional tasks:** Each Tacit script can become a coroutine, a resumable background process, or a reusable component.

Unlike Bash or Python, Tacit can unify **scripting and system integration** with **streaming pipelines, message passing, and direct IO buffering**, all in a minimal syntax.

### 15.3. **Concurrent Stream Processing**

Tacit’s `resumable + pipeline` model is ideal for building dataflow networks, async streams, and real-time transforms.

* **Tasks can suspend on IO or backpressure**, yielding control without needing preemption.
* **Input buffers as FIFO queues** allow decoupled producer-consumer pipelines.
* **Each stage is restartable** — like a coroutine, but more lightweight and compiler-friendly.

Use cases include telemetry, real-time filtering, protocol translation, or embedded control systems that must respond incrementally to input.

### 15.4. **Self-hosted Compilers and Tools**

Because of its **self-contained syntax and stack-based VM**, Tacit is a strong candidate for:

* **Metacompilation:** Writing parts of Tacit in Tacit, including its own compiler or IR transforms.
* **Bootstrapping systems:** Deploying a small interpreter that can grow into a full toolchain in-place.
* **On-device code execution:** Running scripts received over serial, Wi-Fi, or storage without needing to recompile or flash.

This makes Tacit a strong fit for bootloaders, initialization scripts, or educational compilers.

### 15.5. **Experimental Programming Models**

Tacit enables new models of programming that are not easily expressed in conventional languages:

* **Inversion of control through task yield and suspension.**
* **Point-free programming via postfix composition.**
* **Dynamic scope extension and function promotion without closures or GC.**

Tacit lets programmers explore cooperative agents, schedulers, interpreters, and dataflows that are often tedious to express in traditional imperative or functional languages.

## **16. Future Directions and Open Challenges**

Tacit already introduces a radical departure from mainstream language design, but its architecture leaves open rich avenues for refinement. This section outlines what’s ahead — both promising frontiers and technical gaps still to be bridged.

### 16.1. **Scheduler Formalization**

The current model assumes a **simple round-robin cooperative scheduler**, but long-term evolution may require:

* **Priority scheduling or deadline-awareness** for time-sensitive tasks.
* **Event-driven task selection**, possibly integrating with hardware interrupts or IO channels.
* **Fairness models** to avoid starvation among long-waiting tasks.

At present, all tasks are treated equally and rotate through a linked list, but richer models could be introduced incrementally.

### 16.2. **Task Lifecycle and Memory Reclamation**

While resumables are tightly scoped and explicitly promoted, the long-term fate of **idle or orphaned tasks** is an open problem.

* Should they be reference-counted, weak-referenced, or require explicit deallocation?
* Can we design **notification systems** for tasks that detect when their ancestor is cleaned up?
* Will a future system permit **automatic cleanup via region-based lifetimes or arena merging**?

There’s a tension between retaining full programmer control and supporting “fire-and-forget” tasks safely.

### 16.3. **Introspection and Debuggability**

Tacit currently compiles away symbols and assumes a low-level representation. But future tools may require:

* **Partial symbolic retention** for debugging or structured inspection.
* **Interactive introspection of the stack and task state**, especially in environments with no full debugger.
* A potential **hybrid model**, where annotated builds keep symbol maps while production builds erase them.

The key is not to bloat the runtime — any symbolic metadata must be optional and minimal.

### 16.4. **Dynamic Linking and Modules**

All Tacit symbols are global at compile time and baked into the binary image. However:

* Supporting **hot-swapped modules** or **deferred loading** could increase flexibility.
* Tasks may benefit from **dynamic service discovery**, message routing, or late binding of data sources.

This ties into the idea of **registries**, **service handles**, or **symbolic task names**, all of which are optional but desirable in larger systems.

### 16.5. **Networking and Multiprocess Environments**

Tacit is designed for single-machine embedded use, but extending its concurrency model across devices opens new possibilities:

* Lightweight **message-passing protocols** could interconnect Tacit VMs.
* Remote handles or proxies could allow **cross-machine resumable invocation**.
* Embedded Tacit nodes could coordinate using shared protocols over UART, SPI, or TCP.

The task system’s simplicity makes it well-suited to distributed processing, if the messaging layer is lightweight and orthogonal.

### 16.6. **Formal Verification and Safety**

Tacit’s explicit stack and memory model opens the door to formal reasoning:

* **Stack hygiene** can be statically verified by the compiler — avoiding leaks or corruption.
* **Promotion boundaries** could be validated with region rules.
* **Arena models** may allow memory-safe behavior without GC or runtime checks.

In time, Tacit may offer a blend of **Rust-like ownership** with **Forth-like flexibility**, validated entirely at compile time.

## **17. Concluding Reflections and Philosophy**

Tacit is not merely a programming language. It is a philosophical position on computation — a deliberate counterweight to dominant paradigms like functional purity, garbage-collected abstraction, and syntax-heavy scripting. It asks: what could programming look like if we let the hardware speak, but gave it the composability and expressive power we've come to expect?

### 17.1. **From Machines to Minds**

Tacit reclaims something lost in modern computing — a closeness to the machine. But unlike raw assembly, it doesn’t burden the programmer with endless low-level minutiae. Instead, it **uses the stack not just for evaluation, but for meaning**. Execution order, ownership, and lifetime are spatialized on the return stack, not abstracted into closures and heaps.

This isn’t nostalgia. It’s **engineering clarity**.

### 17.2. **The Anti-Closure Language**

Languages like Lisp and JavaScript assume a world of closures, lexical scopes, and garbage-collected semantics. Tacit instead **builds rich behavior out of plain stack frames**. It’s a language of *control*, not *capture*. By avoiding closure-like lifetime ambiguities, Tacit delivers predictable, lightweight abstractions — and makes them explicit.

In short, Tacit is **imperative at its heart, but declarative in spirit**.

### 17.3. **Streamability and Composability**

Tacit programs stream. They can begin before they finish parsing. They can pipeline themselves into IO systems, into tasks, into networks. The semantics of Tacit make it inherently **point-free**, linear, and serializable. These are traits born from **RPN and cooperative multitasking**, not from syntax trees or lambdas.

And they unlock powerful composition without the weight of syntactic ceremony.

### 17.4. **Small Machines, Big Intentions**

While it could be used on desktop platforms, Tacit’s real power is unlocked on the margins — **tiny embedded chips**, **ESP32s**, **forgotten 8-bit microcontrollers**, and **hardware with no OS**. Its memory model, lack of heap dependency, and linear control flow make it ideal for platforms that are typically hostile to modern language runtimes.

Tacit isn’t designed for the cloud. It’s designed for **everywhere the cloud forgot**.

### 17.5. **Tacit as a Tool of Thought**

Tacit brings computation closer to *writing a pipeline* or *assembling a relay circuit* than crafting an abstract mathematical proof. But it’s not low-level in the derogatory sense. It is **minimal, expressive, and introspective** — allowing the programmer to build exactly what they mean, in the order they think it.

And if it feels alien, that’s because we’ve forgotten what it’s like to reason directly with the machine — not in machine code, but in **machine-native semantics**.
