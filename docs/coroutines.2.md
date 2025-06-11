# Tacit Coroutine Model — Specification and Design

## 1. Introduction

Tacit coroutines provide a foundation for cooperative multitasking in environments with strict memory and execution constraints. Unlike traditional resumable functions or heap-managed async models, Tacit coroutines are lightweight, stack-based tasks that share a single global return stack. They are designed to interleave execution in a lock-step, deterministic fashion with minimal runtime overhead.

This document defines the canonical coroutine model in Tacit, including lifecycle, memory structure, scheduling behavior, and integration with local variable management. It formalizes the stack discipline and atomic yield model introduced during the deprecation of resumable functions.

## 2. Motivation and Philosophy

Tacit’s coroutine system exists to solve the problem of structured concurrency in a memory-safe, allocation-constrained environment. Rather than introducing a complex scheduler, independent stacks, or asynchronous continuations, Tacit coroutines adopt a Forth-like discipline:

* **All coroutines share the same return stack.**
* **Tasks are created in stack order and terminated in reverse order (LIFO).**
* **A coroutine cannot clean up until all tasks above it have been terminated.**
* **Emit operations are atomic and yield the coroutine.**
* **Post-yield stack allocation is forbidden to avoid fragmentation.**

This yields a concurrency model that is both **predictable and tightly bounded**, with low memory churn and no garbage collection.

Tacit coroutines reflect a broader philosophy: programs are composed of compact, sequential agents that pass control cooperatively, producing work in bounded, atomic units. Rather than simulating threads, they act like **streams in lock-step**, each suspending after its output and resuming in turn.

## 3. Coroutine Lifecycle

Coroutines in Tacit are defined as **independent tasks that cooperate by yielding**. Each coroutine executes until it yields (typically after emitting data), at which point the scheduler transfers control to the next coroutine in round-robin order. Coroutines are created, suspended, resumed, and eventually terminated in a strictly ordered stack-like structure.

### 3.1 Creation

Coroutines are spawned using a `spawn` operation. This allocates a new frame on the shared return stack, initializes the coroutine’s local variable table, and sets its base pointer (`bp`). The coroutine is added to the scheduler's list of active tasks, ordered by stack position. New coroutines are always spawned *above* the current one.

#### **3.2 Execution**

Once spawned, a coroutine runs until it:

* Emits output via an `emit` operation, after which it **yields**.
* Reaches an internal `yield` point (manually defined).
* Terminates naturally by reaching the end of its body or an explicit termination instruction.

At any yield point, execution is suspended, but the coroutine's state—stack frame, locals, and instruction pointer—remains intact.

#### **3.3 Yielding and Atomicity**

Coroutines **must yield only after completing an atomic emit operation**. That is, all output for a single logical step must be performed before yielding. This includes:

* Emitting values to multiple consumers in a fork.
* Receiving values and combining them in a join before emitting the result.

No coroutine is permitted to yield mid-emission. This ensures that every coroutine performs one atomic unit of work per scheduler tick.

#### **3.4 Termination and Deferred Cleanup**

When a coroutine completes, it enters a **suspended termination state**. However, **cleanup is deferred** until all coroutines above it on the stack have also terminated. This is required because the return stack is shared, and intermediate cleanup would fragment memory.

The scheduler checks whether the terminating coroutine is the **topmost** active coroutine. If it is, it deallocates the coroutine by restoring the stack pointer (`rsp`) to its base pointer (`bp`) and removing the task from the active list. It then checks for more completed tasks beneath it, recursively cleaning up terminated tasks in LIFO order.

This **linearized deallocation rule** ensures that the return stack remains compact and allocation-safe.

## 4. Stack Discipline and Memory Model

Tacit coroutines operate on a **shared return stack**, which serves as the unified memory space for all coroutine execution. This model allows lightweight memory management but requires strict ordering and disciplined control over memory allocation and cleanup.

### 4.1 Shared Return Stack

All coroutines share the same global return stack. Each coroutine is given a **base pointer (`bp`)** when spawned. Its stack frame begins at this pointer and extends upward during initialization. Coroutines are stacked in the order they are spawned, with newer coroutines allocated above older ones.

### 4.2 Variable Table and Local Storage

Each coroutine allocates a **variable table** near its `bp`. This table holds all declared local variables:

* **Scalar values** are stored directly in the table.
* **Buffers and reference types** are stored elsewhere on the stack, with pointers to them placed in the table.

All stack allocation—especially for buffers—must occur **just above the variable table**, early in the coroutine’s lifecycle. This allocation must be completed **before the first yield**.

### 4.3 Stack Cleanup and Deallocation

When a coroutine terminates, it does not immediately clean up its frame. Instead, it waits in a suspended state until **all coroutines above it on the stack have terminated**. Only then can it safely reset the stack pointer to its base pointer and deallocate its memory.

This **LIFO deallocation** prevents fragmentation and keeps stack memory compact and predictable.

### 4.4 Allocation Discipline

No coroutine may allocate new memory after yielding. This guarantees that a coroutine’s memory footprint is fixed once it begins interleaving with other tasks. Post-yield allocation is forbidden to avoid interfering with newer coroutine frames.

Allowed operations after yielding include:

* Accessing or modifying existing local variables
* Emitting or receiving data
* Branching, looping, and other control logic

## 5. Emit and Yield Semantics

Yielding in Tacit is tightly bound to **output**. A coroutine only yields after completing an **emit operation**, which is considered **blocking and atomic**. This model ensures that each coroutine performs a complete unit of work before control is passed to another.

### 5.1 Emit as a Blocking Operation

All emit operations in Tacit are **blocking**—they suspend the coroutine after delivering output to a receiver. This applies to both:

* Single-target emit: sending to one downstream coroutine
* Multi-target emit: sending to multiple branches (e.g., in a fork)

The coroutine yields **only after** the emit is complete. If the receiver is not ready (e.g., channel is full), the coroutine remains suspended at the emit point until space becomes available.

### 5.2 Atomic Output Groups

A coroutine must never yield **midway through an output group**. For example, in a fork that sends to two branches, both outputs must be emitted **together**, and the coroutine yields **after both have completed**. This ensures consistent pacing and prevents skew between branches.

Emit groups must be:

* Fully completed in one execution step
* Followed by a single yield
* Treated as atomic, uninterruptible actions

### 5.3 Joins and Composite Inputs

Similarly, any operation that depends on **multiple incoming values** (e.g., a join) must wait until **all required inputs are received**. Once they are ready, the join operation is processed, and its result is emitted as an atomic step before yielding.

This preserves deterministic flow and ensures that all components of a pipeline remain synchronized on a per-tick basis.

## 6. Task Scheduler

Tacit’s coroutine scheduler is designed for **simplicity, determinism, and stack safety**. It operates on a fixed, cooperative model: each coroutine yields explicitly, and the scheduler advances to the next task in a round-robin cycle. The scheduler enforces stack discipline by managing coroutine lifetimes according to their spawn order.

### 6.1 Round-Robin Scheduling

The scheduler maintains an ordered list of active coroutines, reflecting their physical order on the return stack. On each tick, it resumes **one coroutine**, allowing it to execute until it yields (typically after an emit). It then proceeds to the next coroutine in the list.

This guarantees:

* **One resume per coroutine per tick**
* **Fairness** across all active coroutines
* **Predictable interleaving**, with each coroutine responsible for its own pacing

### 6.2 Spawn Order and Stack Order

Coroutines are spawned sequentially and allocated **on top** of the return stack. Their position in the scheduler matches their position in memory: the last coroutine spawned is the topmost in both the stack and the scheduler list.

This stack-aligned scheduling ensures:

* Stack cleanup can proceed without reordering
* The oldest coroutines reside deepest in the stack and execute longest
* Newer (often short-lived) coroutines sit on top and terminate first

### 6.3 Termination and Cleanup Coordination

When a coroutine terminates, it is marked as completed but is **not immediately deallocated**. The scheduler checks whether the coroutine is the **topmost task**. Only if no active coroutine exists above it can the coroutine be safely removed and its stack reclaimed.

After deallocating the topmost task, the scheduler checks again: if the next coroutine down is also terminated, it is cleaned up as well. This **cascading deallocation** continues down the stack until a live coroutine is encountered.

### 6.4 Suspension Without Cleanup

If a coroutine finishes but is **not the topmost task**, it enters a **suspended termination state**. It remains in the scheduler, idle, until all coroutines above it have completed. Only then is its frame eligible for removal.

This model avoids fragmentation by **guaranteeing LIFO cleanup**, consistent with bump allocation discipline.

### 6.5 Lifecycle Inversion as a Scheduling Heuristic

The LIFO cleanup model is not just a memory management strategy—it also reflects a practical **heuristic about coroutine lifetimes**.

In most programs, **long-running coroutines tend to be spawned early**—such as a main event loop or a persistent data stream. Conversely, **short-lived coroutines** (e.g., request handlers, temporary mappers) are spawned later and terminate quickly.

This natural inversion of **spawn time versus expected lifespan** aligns perfectly with stack discipline:

* **Older coroutines** (spawned earlier) are placed deeper in the stack and expected to live longer.
* **Newer coroutines** (spawned later) are placed on top and often terminate sooner.
* This means short-lived coroutines can be cleaned up quickly and cheaply, without affecting longer-lived ones.

By embracing this structural asymmetry, Tacit’s coroutine scheduler achieves high throughput and memory efficiency while avoiding heap fragmentation or complex reference tracking.

## 7. Communication Primitives

Tacit coroutines communicate through **synchronous message passing**, designed to operate in lock-step coordination. Rather than relying on general-purpose buffering, Tacit favors a **rendezvous-style model**, where each coroutine emits and receives in step with its neighbors, forming a tightly-coupled execution chain.

### 7.1 Channels and Rendezvous Links

Communication between coroutines is modeled as **direct links**, not general-purpose queues. Each link may conceptually resemble a single-slot channel, but its role is not to buffer asynchronous values—it serves as a **synchronization point** between precisely scheduled stages.

* Links are typically **unbuffered**, or at most hold one value briefly between ticks.
* They connect one producer to one or more consumers.
* They are accessed via pointers from the coroutine's variable table.

### 7.2 `emit` Semantics

`emit` is a **blocking and atomic operation**. When a coroutine emits a value:

* It transfers the value to the next stage.
* It **yields immediately afterward**, suspending until the next scheduler tick.
* In the case of a **fork**, all downstream emissions must complete as one unit.

Emit never leaves the coroutine in an ambiguous or half-finished state. This preserves determinism and ensures each tick completes one full unit of work across the pipeline.

### 7.3 `recv` Semantics

`recv` is **non-blocking** in the sense that it does not suspend the coroutine, but it assumes synchronization:

* The coroutine expects the value to be present **precisely at the tick** it’s scheduled to receive.
* If no value is available, the coroutine may skip execution or enter a wait loop.
* Under normal operation, values are always available when expected—**pipelines are designed to remain in sync**.

This model eliminates the need for queues or polling in internal stages. Each coroutine simply pulls the value placed for it by the previous stage in the same tick.

### 7.4 Fork and Join Behavior

Tacit pipelines often branch and merge, but these operations remain **synchronous**:

* **Forks** emit to multiple branches in a single atomic step. Both branches are guaranteed to receive the value in the same tick.
* **Joins** wait for corresponding values from each input branch. Once both are present, the coroutine proceeds, emits its result, and yields.

All stages are **aligned to a common scheduler tick**, so even if one branch filters values, both branches yield, ensuring alignment at the join.

### 7.5 Minimal Buffering and Real-World Boundaries

Tacit avoids buffering between coroutines. Inter-stage flow is expected to be **synchronized**, tick-aligned, and tightly coupled. **Buffers are only introduced at system boundaries**, such as:

* User input queues
* Hardware device I/O
* Asynchronous file or network operations

These external interfaces may require buffering to decouple system timing from the internal coroutine schedule. But within coroutine pipelines, buffering is discouraged to preserve tight coordination and reduce memory overhead.

## 8. Integration with Local Variables

Coroutines in Tacit manage their local state using the same runtime system as ordinary functions, but with a tighter constraint on timing and lifetime. This section outlines how local variables are allocated, used, and cleaned up within coroutine execution.

### 8.1 Variable Table Usage

Each coroutine maintains a **variable table** at the start of its stack frame. This table contains all declared locals for that coroutine:

* **Scalars** are stored directly in the table.
* **Buffers and references** are stored on the stack above the table, and their addresses are recorded in the table.

The compiler assigns slot numbers to each local variable at compile time. These slots index into the variable table, and runtime code accesses them uniformly through that indirection.

### 8.2 Allocation Timing

All local variables must be **fully initialized before the coroutine’s first yield**. This rule is critical to maintain stack safety: any allocation that occurs after yielding risks overlapping with the memory space of newer coroutines spawned above.

During initialization:

* Scalar values are stored directly.
* Buffers are allocated using bump allocation on the return stack.
* The stack pointer grows upward, just above the variable table.

After the first yield, the coroutine may continue to read or modify its existing locals, but **must not allocate new ones**.

### 8.3 Cleanup and Deallocation

When a coroutine terminates and becomes the topmost task on the return stack, its stack frame is cleaned up in one step:

* The stack pointer is reset to the coroutine’s base pointer.
* The variable table is traversed if necessary to release or finalize any resources (e.g., closing buffers or channels).
* This process is uniform and fast, requiring no reference counting or heap management.

Since coroutines must terminate in stack order (LIFO), cleanup is always linear and localized.

### 8.4 Lifetime and Cleanup Discipline

Local variables exist only for the lifetime of the coroutine that owns them. They are initialized before the first yield and live until the coroutine terminates and is cleaned up. No variable may be reallocated or reassigned after yield if it would require additional stack allocation.

Cleanup occurs when the coroutine reaches the top of the return stack and is ready to be deallocated. At that point, the stack pointer is reset to the coroutine’s base pointer, and all memory used by its local variables is released in a single step.

This discipline ensures deterministic, fragment-free memory management across the coroutine system.

## 9. Sentinel Values and Control Signaling

Tacit pipelines rely on deterministic flow and synchronized control. To manage early exits, errors, or end-of-stream conditions, Tacit introduces **sentinel values**—special tagged values used to signal control events across coroutine boundaries.

These sentinels propagate through emit/recv links and influence the behavior of forks, joins, and downstream consumers.

### 9.1 Sentinel Representation

A sentinel is a tagged runtime value that represents a special state. Common sentinel types include:

* **End-of-stream**: signals that no more values will be produced.
* **Error**: indicates a fault or failed precondition.
* **Flush** or **sync markers**: used to align or reset internal state.

Sentinels are distinct from ordinary data and are recognized by the runtime and optionally by the type system. They are passed through emit channels like any other value.

### 9.2 Propagation Through Pipelines

When a coroutine emits a sentinel, the value flows downstream like any normal value, but its **interpretation is special**:

* A downstream coroutine may immediately terminate on receiving a sentinel.
* A coroutine may switch to a cleanup phase or emit its own sentinel.
* A sink may consume the sentinel as a signal to finalize.

Tacit does not automatically propagate sentinels through logic—it is up to the receiving coroutine to respond according to its role.

### 9.3 Fork Behavior

In a **fork**, a value is emitted to multiple downstream branches. If the value is a sentinel, **each branch receives the same sentinel** in the same tick. The behavior of each branch is independent:

* Some may terminate immediately.
* Others may continue temporarily or emit derived sentinel signals.

The fork does not manage control propagation; it simply mirrors the sentinel to each recipient.

### 9.4 Join Behavior

In a **join**, values are received from two or more branches and processed together. If **any branch emits a sentinel**, the join treats the **entire input group as terminated**.

That means:

* If one side emits an end-of-stream, the join assumes **no further input will arrive** from any branch.
* It may emit a sentinel of its own and terminate.
* Any values remaining in other branches may be discarded or drained in a controlled fashion.

This ensures that **partial termination on one side cascades**, allowing the pipeline to close cleanly and in step.

### 9.5 Handling Asymmetric Termination

Sometimes one branch of a join may terminate early while the other is still live. Tacit requires that the joiner take responsibility for coordinating shutdown:

* The join may signal upstream with a sentinel or drain any remaining values.
* Live branches that do not recognize the shutdown may continue emitting unless designed to listen for control signals.
* Cleanup must still obey coroutine stack order; even if logically complete, a coroutine cannot be physically deallocated until it's topmost on the stack.

This model assumes that **sentinels drive logic, not memory**. Termination is cooperative and must be coordinated through communication, not implicit inference.

### 9.6 Sentinel Propagation and Reverse Signaling

Tacit supports a minimal but powerful form of **reverse signaling** using sentinel values. When a downstream coroutine determines that further input is no longer needed—such as after receiving a terminal sentinel from one branch of a join—it can signal upstream coroutines to halt.

This is accomplished not by using dedicated reverse channels, but by **injecting a sentinel directly into the input slot** that the upstream coroutine writes to.

#### Mechanism

* Each coroutine has access to its input slot, which is the same memory location that its upstream sender writes into.
* To signal upstream shutdown, the coroutine **writes a sentinel value into this slot**.
* When the upstream coroutine resumes, it checks the output slot it intends to write into. If it finds a sentinel, it interprets this as a signal that the downstream consumer has terminated.
* The upstream coroutine should then **terminate itself** and, in turn, write a sentinel into its own input slot, continuing the cascade upstream.

This creates a **reverse-propagating chain of sentinels**, with no extra wiring or runtime structure required.

#### Disambiguation and Discipline

There is no distinction between a sentinel written by a coroutine and one injected by downstream. This is intentional and safe under the following rule:

> **A coroutine that emits a sentinel must terminate and must not emit again.**

This ensures that any sentinel present in an output slot is meaningful and final, regardless of origin.

#### Optional Extensions

If more nuanced control signaling is ever required—such as error recovery, pause, or drain—then **typed sentinels** may be introduced to distinguish forward and reverse intent. However, for now, the system assumes all sentinels are interpreted as **termination signals**.

#### Join-Driven Shutdown

When a join stage receives a sentinel on one input, it may write sentinels into the input slots of all its upstream branches. This causes both branches to shut down, even if one was unaware of termination. This model ensures that **partial termination leads to total propagation**, maintaining synchronization and avoiding orphaned emitters.

## 10. Coroutine Spawning and Wiring

In Tacit, coroutines are not just lightweight tasks—they are **linked agents**, connected by explicit data channels and coordinated in memory and time. This section defines how coroutines are spawned, how communication links are created, and who is responsible for allocating shared memory used for communication.

### 10.1 Spawning Semantics

Coroutines are spawned using a `spawn` operation, which performs the following:

* Allocates a new coroutine stack frame on top of the current stack (growing from the current `rsp`)
* Initializes the coroutine’s base pointer (`bp`) and variable table
* Registers the coroutine in the scheduler's task list
* Sets up communication links (see below)

Each coroutine is spawned by another coroutine or a control structure (e.g., `fork`, `pipeline`, `map`) and becomes the **next task above** the current one in the stack hierarchy.

#### 10.2 Link Construction and Ownership

Communication between coroutines relies on **shared memory regions**, typically a single input slot (or small buffer) that one coroutine writes into and another reads from.

The **upstream coroutine** typically:

* Emits values into a memory slot
* Holds a reference to this slot in its variable table

The **downstream coroutine**:

* Reads from this slot
* May also use the same slot to write back a sentinel, enabling reverse signaling

##### **Allocation Responsibility**

The responsibility for **allocating the shared communication memory** lies with the **spawning function or pipeline constructor**—not with the individual coroutines. This ensures:

* Communication memory is allocated once, up front
* All participating coroutines receive pointers to their respective input/output slots before execution begins

Slots are usually stack-resident, allocated just above the variable table of the spawning function. Their lifetimes are tied to the enclosing coroutine frame.

### 10.3 Wiring Patterns

Typical wiring patterns include:

* **Linear pipelines**: each stage receives a reference to its input slot and passes output to the next.
* **Forks**: the fork constructor allocates multiple slots and spawns each branch with its own input reference.
* **Joins**: the join constructor receives multiple inputs and emits to a shared downstream slot.
* **Control loops** (e.g., map/filter): allocate a single reusable slot for iteration.

### 10.4 Lifecycle of Links

Communication links are treated as first-class locals and deallocated along with their owning coroutine frame. They must be:

* Allocated before yielding
* Visible to both ends of the communication
* Invalidated once the corresponding coroutine terminates

Care must be taken that no coroutine attempts to read from or write to a link after its peer has terminated, unless a sentinel or barrier is used to signal the shutdown state.

### 10.5 Scheduling Implications

Since spawning creates new coroutines higher in the stack, the scheduler **adds each new coroutine to the top of its task list**, in physical stack order. This preserves LIFO cleanup and guarantees that newer (often shorter-lived) coroutines can terminate first.

## 11. Coroutine Status and Lifecycle Tracking

Tacit coroutines maintain an internal **status field** that tracks their execution state. This status is used exclusively by the **task scheduler** and system-level orchestration, and not by the coroutines themselves.

### 11.1 Status States

Each coroutine is tagged with one of the following states:

* **Running** – currently executing or ready to resume
* **Yielded** – paused at a yield point
* **Shutting Down** – in the process of completing, may still participate in final synchronization
* **Terminated** – completed and eligible for deallocation
* **Errored** *(optional)* – encountered an unrecoverable error; tagged for diagnostic or supervisory response

These states are not visible to sibling or connected coroutines. They are for system use only.

### 11.2 Purpose and Scope

The status field exists to support:

* **LIFO cleanup**: A coroutine may only be deallocated when it is the top of the coroutine stack *and* marked `terminated`.
* **Stack-safe signaling**: Prevents cleanup of a coroutine that still has active descendants.
* **Error tracking**: Allows the system to associate a reason or code with abnormal termination.
* **Orchestration policies**: Enables supervisor-level code to manage coroutine trees or pipelines holistically.

> Coroutines do **not** check each other’s status. All operational signaling between coroutines is done using **sentinel values** placed into shared input/output slots.

### 11.3 Sentinel vs. Status

The division of responsibility is simple:

* **Sentinels** are visible and propagated between coroutines. They are the sole mechanism for communication between tasks.
* **Status** is local metadata used by the **scheduler or supervisor** to coordinate memory management and lifecycle transitions.

This separation avoids entangling execution logic with task management and preserves coroutine modularity.

### 11.4 Optional Result Signaling

A coroutine may include a **final code or result** (e.g. success/failure) in its status metadata. This is useful for test harnesses, control tasks, or future extensions involving coroutine supervision.

## 12. Summary and Canonical Rules

Tacit’s coroutine system is a **stack-based, cooperative multitasking model** that avoids heap allocation, embraces LIFO cleanup, and uses explicit, synchronous communication between well-scoped tasks. The following principles define its canonical behavior:

### 12.1 Execution Model

* Coroutines are spawned, not called. They do not return values.
* All output is **blocking**—each emit causes a `yield`, enforcing synchronization between stages.
* Coroutines share the return stack and are allocated in strict top-to-bottom order.
* Cleanup is **linear and LIFO**: only the topmost coroutine can be deallocated.

### 12.2 Local Variables and Stack Layout

* Each coroutine frame contains a **variable table** indexed by fixed slots.
* Scalar values are stored directly; buffers and references are stored as pointers to stack-resident memory.
* Buffers are allocated just above the variable table, during initialization.
* No reassignment is allowed for reference variables after yield; scalars may be reassigned freely.
* Cleanup is atomic: restoring `sp = bp` removes both local variables and dynamic allocations.

### 12.3 Communication and Wiring

* All coroutine interaction occurs via shared memory slots for inputs and outputs.
* The **spawning system** is responsible for allocating and wiring these slots before coroutine execution begins.
* Coroutines write into the output slot of the next stage and read from their own input slot.
* No dynamic allocation is required once coroutines are wired and running.

### 12.4 Synchronization and Ticking

* The scheduler advances one coroutine per tick, in round-robin order.
* Forks emit all outputs atomically; joins consume all inputs atomically.
* This rendezvous-style execution avoids buffering within pipelines.
* External I/O (user input, device reads) may require buffered boundaries, but internal pipeline communication does not.

### 12.5 Signaling and Shutdown

* Coroutines signal shutdown using **sentinel values** written to output slots.
* Sentinels propagate downstream normally and upstream by being written into input slots.
* A join stage receiving a sentinel on one input assumes full termination and signals all sources to shut down.
* Only **sentinels**, not status values, are used for inter-coroutine signaling.

### 12.6 Status Tracking and Scheduling

* Each coroutine maintains a private **status field** for scheduler use.
* This field records running/yielded/terminated/error state and optionally a result code.
* The scheduler uses this to determine when tasks can be cleaned up or removed.
* Coroutines do not inspect each other’s status; they rely solely on sentinels for coordination.

Great—I'll go ahead and write it in Tacit-style RPN notation, using minimal stack-based control structures and the arrow-style notation for clarity. I’ll aim for something clean and readable, avoiding anything too Forth-like.

## Appendix A: Coroutine Pipeline Case Study

### A.1 Pipeline Description

This example demonstrates a structured coroutine pipeline for the following computation:

> Generate a range of numbers.
> Fork the stream:
> – One branch squares each number.
> – The other branch filters to odd values.
> Zip the two resulting streams together (join).
> Print the joined pairs.

### A.2 Naive Decomposition

The naive approach assigns one coroutine per logical stage:

1. **Range generator**
2. **Fork**
3. **Squarer**
4. **Odd filter**
5. **Join**
6. **Sync loop (printer)**

Each coroutine is wired to its successor using shared memory slots. Sentinels propagate downstream when any input ends. The fork coroutine yields twice per tick (once per output), and the join awaits both inputs before yielding.

This decomposition has clear modularity but incurs overhead due to frequent yields and memory slots between every stage.

### A.3 Optimized Decomposition

In the optimized version, we collapse all non-blocking stages into a single coroutine chain, retaining only yield boundaries at points of **state-dependent emission**:

1. **Coroutine A**: Range → Fork → Square (→ emits) and Filter (local evaluation)
2. **Coroutine B**: Join → Sync → Print

Only the **filter** branch requires an independent coroutine (**Coroutine A2**) because it selectively blocks emission (i.e. yields only on odd values). The square path emits unconditionally, so it remains inline with the range and fork logic.

This yields the minimal structure:

* **Coroutine A1**: Range → Fork → Square → emit
* **Coroutine A2**: Filter (odd) → emit
* **Coroutine B**: Join → Print

These are wired as:

```
       +--> Square ----+
Range -+               +--> Join --> Print
       +--> Filter (odd)
```

Each `emit` results in a `yield`, preserving tight backpressure. The join coroutine yields only after both inputs are received, maintaining synchronous flow. Shutdown is initiated by the range, propagated via sentinels.

### A.4 Observations

* The fork stage does not need to yield independently; it just calls emit on each branch.
* The join performs an atomic yield after consuming both inputs.
* The filter stage requires a separate coroutine only because it may skip yields.
* Cleanup is linear and well-defined: the print coroutine terminates last.


## Appendix B: Coroutine Pipeline in Tacit Notation

### B.1 Coroutine A1: Range → Fork → Square

This coroutine produces the range of values and emits two copies—one to the square path, one to the filter path.

```tacit
coroutine range-fork-square
  0 → $i
  loop:
    $i dup emit-square emit-filter
    $i 1 + → $i
    yield
  end
```

Helper procedures:

```tacit
word emit-square
  dup dup * → $sq
  $sq out-square !

word emit-filter
  out-filter !
```

* `out-square` and `out-filter` are output slots wired to downstream coroutines.
* `emit` means assignment to an output slot and causes a `yield`.
* In this coroutine, `emit-filter` is just a store; it doesn’t yield here.

### B.2 Coroutine A2: Filter Odd

This coroutine receives values from `out-filter` and only emits if the value is odd.

```tacit
coroutine filter-odd
  loop:
    in-filter @ → $x
    $x 1 & if
      $x out-join-left !
      yield
    then
  end
```

* `in-filter` is wired to the output of `range-fork-square`.
* `out-join-left` feeds the left input of the join.

### B.3 Coroutine B: Join → Print

This coroutine collects both inputs and prints the pair.

```tacit
coroutine join-print
  loop:
    in-join-left @ → $a
    in-join-right @ → $b
    $a $b print-pair
    yield
  end
```

Helper:

```tacit
word print-pair
  "[" . $a . ", " . $b . "]" .
```

* `in-join-left` and `in-join-right` are the two inputs to the join.
* This coroutine yields once per joined pair.

### B.4 Wiring

* `range-fork-square` emits to `out-square` → `in-join-right`, and `out-filter` → `in-filter`
* `filter-odd` emits to `out-join-left`
* `join-print` consumes `in-join-left` and `in-join-right`

