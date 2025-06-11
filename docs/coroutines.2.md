# Tacit Coroutines

## Table of Contents

- [1. Introduction](#1-introduction)
- [2. Motivation and Philosophy](#2-motivation-and-philosophy)
- [3. Coroutine Lifecycle](#3-coroutine-lifecycle)
  - [3.1 Creation](#31-creation)
  - [3.2 Execution](#32-execution)
  - [3.3 Yielding and Atomicity](#33-yielding-and-atomicity)
  - [3.4 Termination and Deferred Cleanup](#34-termination-and-deferred-cleanup)
- [4. Stack Discipline and Memory Model](#4-stack-discipline-and-memory-model)
  - [4.1 Shared Return Stack](#41-shared-return-stack)
  - [4.2 Variable Table and Local Storage](#42-variable-table-and-local-storage)
  - [4.3 Stack Cleanup and Deallocation](#43-stack-cleanup-and-deallocation)
  - [4.4 Allocation Discipline](#44-allocation-discipline)
- [5. Emit and Yield Semantics](#5-emit-and-yield-semantics)
  - [5.1 Emit as a Blocking Operation](#51-emit-as-a-blocking-operation)
  - [5.2 Atomic Output Groups](#52-atomic-output-groups)
  - [5.3 Joins and Composite Inputs](#53-joins-and-composite-inputs)
- [6. Task Scheduler](#6-task-scheduler)
- [7. Communication Primitives](#7-communication-primitives)
- [8. Integration with Local Variables](#8-integration-with-local-variables)
- [9. Termination and Cleanup](#9-termination-and-cleanup)
- [10. Coroutine Status and Scheduler Coordination](#10-coroutine-status-and-scheduler-coordination)
  - [10.1 Usage by the Scheduler](#101-usage-by-the-scheduler)
  - [10.2 Transition Rules](#102-transition-rules)
  - [10.3 Integration with Sentinel Signaling](#103-integration-with-sentinel-signaling)
  - [10.4 Status Extension](#104-status-extension)
- [11. Spawning, Wiring, and Coordination](#11-spawning-wiring-and-coordination)
  - [11.1 Allocation and Lifetime](#111-allocation-and-lifetime)
  - [11.2 Stack Order and Nesting](#112-stack-order-and-nesting)
  - [11.3 Wiring and Communication Memory](#113-wiring-and-communication-memory)
  - [11.4 Two-Way Signaling](#114-two-way-signaling)
  - [11.5 Summary](#115-summary)
- [12. Task Scheduler Model](#12-task-scheduler-model)
  - [12.1 Tick Cycle and Resume Logic](#121-tick-cycle-and-resume-logic)
  - [12.2 Stack Discipline and Termination](#122-stack-discipline-and-termination)
  - [12.3 Blocking and Backpressure](#123-blocking-and-backpressure)
  - [12.4 Task List and Round-Robin Order](#124-task-list-and-round-robin-order)
  - [12.5 External Events and Interruptions](#125-external-events-and-interruptions)
  - [12.6 Scheduling Invariants](#126-scheduling-invariants)
- [13. Sentinel Propagation and Termination Signaling](#13-sentinel-propagation-and-termination-signaling)
  - [13.1 Definition and Semantics](#131-definition-and-semantics)
  - [13.2 Downstream Propagation](#132-downstream-propagation)
  - [13.3 Upstream Propagation](#133-upstream-propagation)
  - [13.4 Fork and Join Semantics](#134-fork-and-join-semantics)
  - [13.5 Cleanup and Termination](#135-cleanup-and-termination)
  - [13.6 Sentinel Safety](#136-sentinel-safety)
- [14. Coroutine Status and Lifecycle Management](#14-coroutine-status-and-lifecycle-management)
  - [14.1 Status Values](#141-status-values)
  - [14.2 Status-Driven Cleanup](#142-status-driven-cleanup)
- [Appendix A: Coroutine Pipeline Case Study](#appendix-a-coroutine-pipeline-case-study)
  - [A.1 Pipeline Description](#a1-pipeline-description)
  - [A.2 Naive Decomposition](#a2-naive-decomposition)
  - [A.3 Optimized Decomposition](#a3-optimized-decomposition)
  - [A.4 Observations](#a4-observations)
- [Appendix B: Coroutine Pipeline in Tacit Notation](#appendix-b-coroutine-pipeline-in-tacit-notation)
  - [B.1 Coroutine A1: Range → Fork → Square](#b1-coroutine-a1-range--fork--square)
  - [B.2 Coroutine A2: Filter Odd](#b2-coroutine-a2-filter-odd)
  - [B.3 Coroutine B: Join → Print](#b3-coroutine-b-join--print)
  - [B.4 Wiring](#b4-wiring)

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

### **3.2 Execution**

Once spawned, a coroutine runs until it:

* Emits output via an `emit` operation, after which it **yields**.
* Reaches an internal `yield` point (manually defined).
* Terminates naturally by reaching the end of its body or an explicit termination instruction.

At any yield point, execution is suspended, but the coroutine's state—stack frame, locals, and instruction pointer—remains intact.

### **3.3 Yielding and Atomicity**

Coroutines **must yield only after completing an atomic emit operation**. That is, all output for a single logical step must be performed before yielding. This includes:

* Emitting values to multiple consumers in a fork.
* Receiving values and combining them in a join before emitting the result.

No coroutine is permitted to yield mid-emission. This ensures that every coroutine performs one atomic unit of work per scheduler tick.

### 3.4 Termination and Deferred Cleanup

When a coroutine finishes execution, it enters a **terminated state** but is not immediately cleaned up. Because all coroutines share the return stack, cleanup is deferred until the coroutine becomes the **topmost task** on the stack.

At that point:

* The coroutine’s stack frame is deallocated by restoring the stack pointer to its base pointer.
* The scheduler removes it from the task list.
* If any terminated coroutines lie immediately beneath, they are cleaned up recursively in LIFO order.

This rule ensures stack compactness and prevents memory fragmentation. No coroutine may be cleaned up while others remain active above it.

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

Coroutines must complete **all memory allocation before their first yield**. This rule guarantees that:

* Coroutine stack frames are compact and fixed in size once interleaved.
* No overlapping allocations occur between parent and child tasks.
* Memory safety is preserved without dynamic tracking.

After yielding:

* Coroutines may read or update existing locals.
* No new buffers or reference allocations are allowed.
* Control flow (e.g. loops, branches) may continue, but must not increase the stack footprint.

This discipline enables fast, deterministic cleanup and ensures that all memory used by a coroutine lies within its original frame.

## 5. Emit and Yield Semantics

Yielding in Tacit is tightly coupled with **emit** operations. Each coroutine produces output in discrete, atomic steps, yielding only after all outputs for that step are complete. This coordination model ensures determinism and tight pipeline coupling.

### 5.1 Emit as a Blocking Operation

`emit` is a **blocking** instruction that:

* Transfers a value to a connected receiver.
* Immediately suspends coroutine execution.
* Guarantees that no further work is performed until the coroutine resumes on the next tick.

Emit always yields after completing, even in simple pipelines. This allows precise backpressure control and lock-step execution.

### 5.2 Atomic Output Groups

When emitting to multiple consumers (e.g., in a fork), all emissions form a single **atomic group**. The coroutine:

* Emits all outputs.
* Yields only after the full group is emitted.

Partial emission or interleaved output is forbidden. This ensures that forks remain synchronized and downstream consumers receive matching values per tick.

### 5.3 Joins and Composite Inputs

Join operations must wait for **all required inputs** before proceeding. When ready:

* The join processes its inputs.
* Emits its result downstream.
* Yields in a single atomic step.

No join may emit without receiving a complete input set. This preserves tick-level synchronization and consistent flow control.

## 6. Task Scheduler

The Tacit scheduler implements cooperative multitasking using a fixed, round-robin cycle over a linear list of active coroutines. Each coroutine yields control explicitly; there is no preemption. On each tick, the scheduler resumes a single coroutine, allowing it to execute until it yields—typically after an `emit`. Control then passes to the next task in the list, continuing in a circular sequence. This ensures fair interleaving and bounded execution without introducing non-determinism.

Coroutines are spawned sequentially and added to the top of the return stack. Their position in the task list reflects this same physical order: newer coroutines appear later in the schedule and reside higher in memory. The last coroutine spawned is always the topmost coroutine in both the return stack and the scheduler. This correspondence between physical and logical order allows stack-safe cleanup without heap tracking.

When a coroutine terminates, it is marked as completed but remains on the task list. It may not be deallocated until all coroutines spawned after it have also terminated. After each tick, the scheduler checks whether the topmost task is both terminated and the highest active coroutine. If so, it resets the return stack pointer to the coroutine’s base pointer and removes the coroutine from the list. This process repeats downward until a live coroutine is reached. Cleanup is thus recursive, top-down, and linear in physical stack order.

If a coroutine finishes but is not the topmost task, it enters a suspended state and remains idle in the task list. Its stack frame persists unchanged until it becomes the topmost terminated coroutine, at which point cleanup can proceed.

This model ensures LIFO cleanup and memory compactness. It reflects an implicit heuristic: long-lived coroutines tend to be spawned earlier and sit deeper in the stack, while short-lived ones are typically spawned later and reside higher. The result is that short-lived tasks can exit without interfering with deeper, longer-lived structures, preserving memory locality and eliminating fragmentation.

## 7. Communication Primitives (Restored and Clarified)

Tacit coroutines interact through direct, synchronous communication channels. These channels serve not only to transfer values but to coordinate execution timing. Rather than buffering, Tacit prefers tightly coupled, tick-aligned rendezvous-style communication, where each emit and receive is matched in the same scheduler cycle.

Communication is based on statically wired memory slots—small, stack-resident regions shared between exactly one sender and one or more receivers. These slots act as single-value mailboxes rather than asynchronous queues. All communication is structured to occur in predictable, lock-step order across pipeline stages.

Each coroutine references its input and output channels via pointers held in its local variable table. The memory for these links is allocated by the spawning structure—never by the coroutines themselves—and resides within the coroutine stack frame of the parent.

Emissions are always blocking and atomic: a coroutine may not emit partially or yield mid-group. Each emit delivers a value (or set of values) and yields immediately, ensuring that each coroutine performs a single, consistent unit of work per tick.

Receives are not blocking in the traditional sense. Rather, a coroutine is expected to access its input slot only when it is scheduled and only when data is available. If no value is present, the coroutine may detect this explicitly (e.g. via a flag or sentinel) and skip execution for the tick. In general, however, the system is designed so that senders and receivers are synchronized, and each stage will receive the values it expects when it is scheduled.

Forks and joins are constructed from the same primitives. In a fork, the same value is emitted to multiple output slots in one atomic operation. Each receiver will then observe the value independently on the same tick. In a join, the coroutine waits for values from two or more input slots. The join proceeds only when all required inputs are present, then performs its operation and emits a result, followed by a yield.

Forks must not yield between output branches, and joins must not proceed with partial input. All branches in a fork receive their copy of the value at once; all branches in a join must align before progressing. This strict synchronization ensures determinism, avoids skew, and maintains consistent backpressure across all paths.

Tacit discourages buffering between coroutine stages. Pipelines are constructed with the assumption of synchronized data flow. Buffering is introduced only at system boundaries—such as for device input or asynchronous APIs—where alignment with the coroutine schedule is not possible. Within the pipeline, however, communication is immediate, aligned, and non-redundant.

## 8. Integration with Local Variables

Each coroutine in Tacit maintains a local variable table, allocated on the return stack upon coroutine spawn. This table is indexed by slot IDs assigned at compile time. It maps to scalars, buffers, and references, and is shared with the code executed within that coroutine as its local scope.

Scalar values (e.g. numbers or tagged small objects) are stored directly in the table. Buffers and reference types are allocated just above the variable table on the stack and stored in the table as pointers. These references remain valid as long as the coroutine is alive and are automatically discarded during cleanup.

Variable initialization is lazy: each variable is only instantiated when the coroutine first reaches the code that requires it. This allows for conditional setup and avoids allocating unused resources. The layout of the table is static, but the actual memory backing complex objects is dynamic and stack-based.

To support the coroutine model’s strict cleanup discipline, buffer allocation must occur before the first `yield`. Once a coroutine yields, the stack pointer must not move independently; it must remain stable to ensure deterministic deallocation. Therefore, any local buffers must be fully allocated and assigned during initialization or before the first suspended point in the coroutine's execution.

The compiler must ensure that all variables are initialized before their first use, and no variable may be written after a `yield` unless its allocation was already completed. This preserves the invariants required by LIFO cleanup and avoids corruption of inter-coroutine memory.

Variables that store only scalar values may be reassigned freely within the coroutine’s lifetime. However, references to buffers or other dynamically allocated objects are typically not reassigned after their initial creation. This constraint helps avoid fragmentation and prevents accidental reallocation of large or persistent structures during inner loops or repeated logic.

The entire local variable table is cleaned up by traversing it from highest to lowest slot, releasing any reference-counted or dynamically allocated elements. Once complete, the stack pointer is reset to the coroutine's base pointer (`bp`), and the table is discarded.

## 9. Termination and Cleanup

Tacit coroutines operate on a shared return stack, which imposes strict ordering constraints on allocation and cleanup. Coroutines are spawned in stack order, and each occupies a contiguous segment of stack memory—including its local variable table and any associated buffers. Because of this, cleanup must proceed **in reverse stack order**: a coroutine can only be deallocated once all coroutines spawned after it have already terminated.

This LIFO discipline ensures that no coroutine can free memory still in use by another. It also avoids fragmentation, since the stack always grows and shrinks in a predictable, monotonic pattern. The coroutine scheduler must respect this invariant: **no coroutine may be fully destroyed until all higher coroutines are gone**.

When a coroutine terminates—either by completing its logic or receiving a sentinel indicating shutdown—it does not immediately release its memory. Instead, it marks itself as **terminated** and waits for deallocation eligibility. This status must be visible to the scheduler, which will walk back the stack and free coroutines in order, resetting the stack pointer (`sp`) to the base pointer (`bp`) of the most recently terminated coroutine.

Deallocation involves:

1. Traversing the local variable table and releasing any reference-counted or heap-linked items.
2. Resetting the stack pointer to the coroutine's base (`bp`).
3. Restoring the previous coroutine's control state, allowing it to resume or also terminate.

Importantly, **no coroutine may grow its stack region after the first yield**. All stack allocations (e.g. buffers) must be performed during initialization, before the coroutine yields for the first time. This constraint guarantees that the memory layout above any coroutine is fixed once execution begins, avoiding collisions or corruption.

Coroutines may retain status information—such as “running,” “yielded,” “terminated,” or “waiting for deallocation”—which helps the scheduler determine cleanup eligibility. This metadata may also carry success/failure codes or diagnostic data, but is **not** directly exposed to other coroutines. Instead, coroutine-to-coroutine signaling is done using sentinel values passed via communication channels.

This disciplined cleanup model minimizes memory overhead and supports high-throughput, real-time coroutine chains without garbage collection, buffering, or heap churn.

## 10. Coroutine Status and Scheduler Coordination

Each coroutine maintains a minimal status indicator that reflects its execution state. This status is distinct from sentinel values and is used exclusively by the scheduler or spawning system to coordinate execution, cleanup, and task lifecycle management.

A coroutine’s status is one of the following:

* **Active**: the coroutine is scheduled and may yield or emit.
* **Yielded**: it has suspended and awaits resumption.
* **Shutting down**: it has emitted a terminal sentinel and is in a cleanup phase.
* **Terminated**: it has completed execution and is ready for deallocation.

These states are tracked explicitly by the scheduler, not inferred from data values.

### 10.1 Usage by the Scheduler

The scheduler consults coroutine status to decide whether:

* The coroutine is eligible for resumption.
* Its memory frame may be deallocated.
* Its downstream receivers should be notified.
* It has exited cleanly or in an error state.

This status is not visible to other coroutines directly. Sentinels remain the only inter-coroutine signaling mechanism.

### 10.2 Transition Rules

Status transitions are strictly ordered:

1. Active → Yielded: coroutine suspends awaiting next tick.
2. Yielded → Active: scheduler resumes the coroutine.
3. Active → Shutting down: coroutine emits sentinel, begins cleanup.
4. Shutting down → Terminated: coroutine reaches end and is ready for collection.

All transitions occur at well-defined points in the coroutine’s logic. This permits the scheduler to enforce a stack discipline where only the topmost coroutine may be deallocated.

### 10.3 Integration with Sentinel Signaling

While coroutines use sentinels to communicate with each other, status values are used to manage their presence on the shared return stack. Sentinels initiate shutdown behavior, but status determines *when* a coroutine is allowed to release its memory.

A coroutine that has emitted a sentinel may still run additional cleanup code before being marked terminated. During this time, the scheduler considers it shutting down, and will not deallocate it until all younger coroutines have terminated.

### 10.4 Status Extension

This model can be extended to include result codes, success/failure flags, or shutdown causes. These extensions would be used by the scheduler or outer control logic to coordinate logging, error handling, or recovery behaviors. However, these are implementation details and not exposed at the coroutine interface level.

## 11. Spawning, Wiring, and Coordination

Coroutine creation in Tacit is explicit and stack-bound. Coroutines are not called like normal functions; they are *spawned*, meaning they are allocated on the shared return stack and persist until termination. Spawning is performed in stack order: newer coroutines are placed above older ones, ensuring that cleanup and deallocation proceed in a linear, LIFO fashion.

### 11.1 Allocation and Lifetime

When a coroutine is spawned, it is assigned:

* A local variable table, preallocated with slot entries.
* A region of stack memory above the variable table for any buffers or state.
* Input/output pointers or references used for communication.

The lifetime of the coroutine extends until it terminates with a sentinel and is the topmost active task on the return stack. Deallocation occurs only when no younger coroutines remain.

### 11.2 Stack Order and Nesting

All coroutines share the return stack. This means:

* Spawning is always nested: child routines are placed above parents.
* Cleanup is ordered: a coroutine cannot be reclaimed until all coroutines above it have terminated.
* Fragmentation is avoided by enforcing this LIFO order.

This model favors longevity for base routines and rapid disposal of short-lived child tasks. It exploits the common structural pattern in pipelines, where long-lived sources and sinks enclose transient transformations.

### 11.3 Wiring and Communication Memory

Each coroutine must be connected to others via shared communication memory. This memory consists of:

* Input slots: typically a single location for receiving values.
* Output slots: pointers to downstream coroutine input slots.

Allocation of this memory is the responsibility of the *spawning system*. When a coroutine is created, it is wired to its downstream receiver (or receivers, in the case of a fork). This wiring includes both data linkage (e.g. where to write values) and status signaling (e.g. where to inject a sentinel if needed).

These input/output connections are not queues by default. Most pipelines operate in a lock-step, tick-synchronized fashion. Each coroutine emits to its connected receivers and yields immediately. Backpressure is implicit: a coroutine cannot emit again until it has been resumed by the scheduler, and receivers must be ready.

### 11.4 Two-Way Signaling

Though most communication is downstream (data values), upstream signaling can occur via sentinel propagation. This is enabled by the shared communication memory: downstream coroutines may inject sentinels into upstream input slots to trigger shutdown cascades. Thus, wiring is inherently bidirectional in control terms, even if dataflow is unidirectional.

No coroutine needs knowledge of its peer’s internal state. Coordination occurs strictly via shared communication memory and status flags. This enforces decoupling and makes wiring mechanical and safe to generate during coroutine spawning.

### 11.5 Summary

Coroutine spawning establishes a physical and logical structure: stack-based lifetime, variable-local memory, and direct wiring to peers. The allocation, connection, and cleanup rules are tightly disciplined to avoid heap usage, dynamic dispatch, or runtime lookup of control relationships.

## 12. Task Scheduler Model

The Tacit coroutine system relies on a simple, cooperative task scheduler. This scheduler is non-preemptive, single-threaded, and tick-driven. Each tick resumes one coroutine at a time in a round-robin cycle. Tasks yield voluntarily after emitting, and cannot continue until their next scheduled turn. This structure ensures deterministic scheduling, avoids race conditions, and supports implicit backpressure without buffers.

### 12.1 Tick Cycle and Resume Logic

On each scheduler tick:

1. The next active coroutine is selected in round-robin order.
2. It is resumed at its last yield point.
3. It performs one logical step (e.g., consuming input, processing, and emitting output).
4. If it emits, it yields immediately afterward.
5. If it has nothing to emit, it may yield preemptively or block waiting for input.

This simple tick model ensures that all active coroutines make progress in a predictable sequence. No coroutine can monopolize execution.

### 12.2 Stack Discipline and Termination

Because coroutines share the return stack, they are terminated in stack order. A coroutine may not be deallocated until:

* It has emitted a sentinel value indicating termination.
* All coroutines above it on the stack have also terminated.

This linear deallocation policy avoids fragmentation and simplifies memory cleanup. The scheduler tracks coroutine status (see Section 10) to determine whether a coroutine can be removed.

### 12.3 Blocking and Backpressure

All output is considered blocking. Emission is followed by an immediate yield. This enforces backpressure: a coroutine cannot emit again until the consumer has resumed and accepted the value. As a result, pipelines remain synchronized without explicit queues.

Input is *not* blocking. A coroutine may read from its input slot without yielding. If no input is present, it may choose to yield or perform a different action. This distinction simplifies coordination and avoids deadlocks in tick-synchronous pipelines.

### 12.4 Task List and Round-Robin Order

The scheduler maintains an ordered list of all spawned coroutines. This list is traversed in order each tick. When a coroutine terminates, it is removed from the list (if it is the topmost), and the scheduler adjusts the round-robin pointer accordingly.

The task list structure is a simple array or ring buffer. Because coroutines do not migrate between execution contexts, no complex task switching is needed.

### 12.5 External Events and Interruptions

Device I/O, user interaction, or clock-based events may be handled by a special coroutine responsible for interfacing with the outside world. This coroutine may yield with sentinel signals or inject input values into pipelines. External interactions are mediated through these dedicated routines to maintain scheduler discipline and tick alignment.

### 12.6 Scheduling Invariants

To maintain consistency and avoid corruption:

* Only one coroutine is resumed per tick.
* Yield points are mandatory after every emit.
* Coroutine creation and termination must preserve stack order.
* Cleanup occurs strictly from top to bottom of the return stack.

These rules enforce a clean, bounded, and linear coroutine model, with minimal runtime complexity.

## 13. Sentinel Propagation and Termination Signaling

Sentinel values are used to indicate control signals such as termination, errors, or shutdown conditions within a coroutine pipeline. They act as the primary mechanism for communicating lifecycle transitions between coroutines and provide a uniform model for halting execution, cleaning up resources, and triggering upstream or downstream effects.

### 13.1 Definition and Semantics

A sentinel is a special, recognizable value injected into a coroutine’s communication channel. It signals:

* **End of stream**: no more data will be emitted.
* **Error or early exit**: an exceptional condition has occurred.
* **Shutdown**: downstream is no longer accepting input.

Sentinels are treated as first-class values with reserved meaning. Their arrival halts normal data processing and initiates coordinated shutdown across the pipeline.

### 13.2 Downstream Propagation

When a coroutine receives a sentinel from upstream, it interprets it as an end-of-input signal. It may:

* Propagate the sentinel to its own output.
* Perform cleanup.
* Yield and mark itself as terminated.

This ensures that termination flows *forward* through the pipeline, mirroring normal dataflow.

### 13.3 Upstream Propagation

In some scenarios, a coroutine may wish to signal *upstream* that it is no longer accepting input (e.g., due to early exit or a join condition). This is accomplished by injecting a sentinel into the upstream coroutine’s input slot.

Because all coroutines share communication memory (usually a single input value slot), a downstream coroutine may overwrite this slot with a sentinel, signaling that further emissions are unnecessary. The upstream coroutine, upon reading the sentinel, enters shutdown.

Upstream propagation thus flows *backward* through the pipeline, enabling early cleanup and release of resources.

### 13.4 Fork and Join Semantics

* **Fork**: When a fork emits to multiple downstreams, a sentinel sent to either output branch propagates independently. Each downstream handles shutdown on its own. Fork logic does not merge sentinel behavior—it simply dispatches.

* **Join**: When a join receives a sentinel on *any* input branch, it treats the entire input set as terminated. The join coroutine immediately propagates a sentinel downstream and halts further reads from all branches.

This rule ensures deterministic shutdown in parallel pipelines, even when only one branch detects the end condition.

### 13.5 Cleanup and Termination

Once a sentinel is received or emitted, the coroutine must:

* Mark its status as “shutting down” or “terminated.”
* Stop emitting values.
* Yield to allow the scheduler to proceed with cleanup.

Termination is considered *complete* only when all coroutines above a given coroutine on the stack have also shut down. Until then, the coroutine remains in memory, although it may be inactive.

### 13.6 Sentinel Safety

To avoid confusion:

* Coroutines must not emit further values after emitting or receiving a sentinel.
* Input slots must be cleared before each tick to avoid misreading stale sentinel values.
* Special care must be taken to distinguish self-written sentinels (for signaling upstream) from incoming ones.

A unique sentinel constant is typically used, but multiple sentinel types (e.g., `EOF`, `ERROR`) may be supported to indicate different shutdown reasons.

This propagation system ensures robust, decentralized control flow with minimal state and no need for dynamic linkage between coroutine internals.

## 14. Coroutine Status and Lifecycle Management

Coroutine status reflects its current state in the execution lifecycle and is crucial for proper scheduling, cleanup, and error handling. The scheduler and control logic depend on this status to enforce stack discipline and linear deallocation.

### 14.1 Status Values

Each coroutine maintains one of the following status values:

* **Active** – Running and able to emit data.
* **Yielded** – Suspended after emitting or yielding voluntarily.
* **Shutting Down** – Received or emitted a sentinel; in the process of cleanup.
* **Terminated** – Fully complete and eligible for deallocation.

Status changes are explicit and correspond to coroutine logic and sentinel propagation.

### 14.2 Status-Driven Cleanup

Because coroutines are stacked, a coroutine cannot be cleaned up unless:

* Its status is **Terminated**.
* All coroutines above it in the stack are also **Terminated**.

This constraint ensures memory is reclaimed in stack order, avoiding fragmentation or use-after-free errors. Status values provide the scheduler with visibility into this readiness.

### 14.3 Role in Communication

Although status is not exposed between coroutines (which communicate only via sentinels), it plays a critical role in:

* Scheduler tick logic: determines which coroutines are resumed or skipped.
* Coroutine spawning: disallows spawning from already-terminated contexts.
* Shutdown coordination: coroutines marked “Shutting Down” still yield to allow downstream cleanup.

### 14.4 Optional Extension: Return Codes

Coroutines may optionally attach a result or exit code to their termination state. This code is not passed through the data stream but is visible to the parent or task supervisor. It allows:

* Error propagation in structured pipelines.
* Differentiation between normal and abnormal exits.
* Logging or user feedback.

Return codes are advisory and do not affect pipeline logic unless interpreted by the parent.

### 14.5 Scheduler Responsibilities

The task scheduler must:

* Track the status of every coroutine.
* Ensure stack-aligned deallocation.
* Prioritize newly spawned coroutines at the top of the stack.
* Skip or ignore coroutines in `Shutting Down` or `Terminated` state.

All status changes occur at yield points or upon sentinel handling. Status is never inferred from memory state—only explicitly updated.

This structured model ensures clarity, safe resource cleanup, and a fully predictable coroutine lifecycle.

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

