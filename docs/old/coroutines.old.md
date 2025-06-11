# Co-routines and Task Scheduling

## Introduction

Tacit's co-routine system provides lightweight concurrency through cooperative multitasking. Unlike traditional threading models that require complex context switching and separate memory spaces, Tacit co-routines (CRs) share the same memory architecture that powers the rest of the language. This document explains how co-routines work, how they interact with Tacit's stack-based model, and how they enable asynchronous programming while maintaining simplicity and memory efficiency.

## Core Concepts

### Single-Threaded, Async-First Design

Tacit takes a fundamentally different approach to concurrency compared to most programming environments:

1. **Truly Single-Threaded**: Unlike systems that emulate concurrency with OS threads or worker pools, Tacit is genuinely single-threaded. There is exactly one execution path active at any moment, which eliminates entire categories of concurrency bugs like race conditions and deadlocks.

2. **Explicit Yield Points**: Co-routines yield control only at well-defined points in the code, making program flow predictable and traceable. There's no preemption or time-slicing that could interrupt execution at arbitrary points.

3. **Async by Design**: Rather than adding asynchronous capabilities as an afterthought, Tacit treats asynchronous operation as the fundamental model. This inversion leads to more intuitive handling of I/O, timing, and event-driven programming.

4. **Zero-Cost Abstraction**: The co-routine mechanism adds minimal overhead to Tacit's existing stack-based structure. There's no separate runtime, thread management, or context-switching machinery.

5. **Problem Decomposition**: Co-routines in Tacit are primarily a tool for breaking complex problems into simpler, independent components that communicate through well-defined channels, rather than for exploiting multiple CPU cores.

These design choices lead to a system that is simultaneously simpler, more predictable, and more maintainable than traditional concurrency models, while still providing the benefits of non-blocking, responsive execution.

### What is a Co-routine?

A co-routine in Tacit is a function that can pause its execution at specific points, allowing other code to run, and then resume later from exactly where it left off. This ability to pause and resume creates an illusion of concurrent execution within a single-threaded environment.

Unlike conventional functions that follow a strict "start-complete" lifecycle, co-routines can yield control midway through execution, effectively saying "I'll pause here, let something else run, and continue when I'm called again."

Co-routines provide a powerful tool for:

- Breaking complex operations into manageable steps
- Handling asynchronous operations without callback nesting
- Creating producer/consumer relationships
- Building event-driven systems
- Implementing lightweight services
- Managing I/O without blocking the entire system

### How Co-routines Fit into Tacit's Architecture

Tacit is fundamentally a stack-based language with two primary stacks: the data stack and the return stack. Co-routines leverage this existing infrastructure rather than requiring a separate mechanism:

1. **Shared Return Stack**: All co-routines share the same return stack, with each co-routine owning a segment of that stack while active.

2. **Private Data Stacks**: While co-routines share the physical memory architecture, each can maintain a private data stack using buffer allocation, preventing unexpected data interactions.

3. **Minimal State**: Each co-routine requires only a few bytes of state management: instruction pointer (IP), base pointer (BP), return stack pointer (RP), and status flags.

4. **No Preemption**: Co-routines yield control voluntarily at well-defined points, resulting in predictable execution flow and eliminating the need for complex synchronization primitives.

## Co-routine Lifecycle

### Creation and Initialization

When a new co-routine is created, Tacit:

1. **Allocates a State Record**: Creates minimal tracking information for the new co-routine.

2. **Sets Up Stack Frame**: Establishes a region on the shared return stack that will hold local variables and buffers for the co-routine.

3. **Transfers Parameters**: Moves any parameters from the parent's data stack to the co-routine's stack frame.

4. **Initializes Private Data Stack**: Allocates a buffer to serve as a required private data stack for the co-routine.

5. **Sets Entry Point**: Records the instruction address where the co-routine should begin execution.

6. **Registers with Scheduler**: Adds the co-routine to the system's run queue, making it eligible for execution.

The creation of a co-routine is remarkably lightweight, requiring only a few operations and minimal memory overhead.

### Yielding and Resuming

The core of co-routine functionality is the ability to yield control and later resume:

1. **Yielding**: When a co-routine calls `yield`, it:
   - Saves its current instruction pointer
   - Updates its status to "ready" (not running, but can resume)
   - Allows the scheduler to select the next co-routine to run

2. **Resuming**: When a co-routine is selected to run again, the system:
   - Restores its instruction pointer
   - Sets its status to "running"
   - Jumps to the instruction where it previously paused

This switch between co-routines is efficient, involving only a few register changes and a jump instruction.

### Termination and Cleanup

When a co-routine completes its work:

1. **Status Change**: Its status is marked as "suspended" or "terminated".

2. **Cleanup Evaluation**: The system checks if the co-routine can be fully removed:
   - A co-routine can only be cleaned up if there are no active co-routines with higher return stack positions
   - This "temporal stack principle" ensures orderly cleanup and prevents fragmentation

3. **Resource Release**: When eligible, the co-routine's resources are released by simply adjusting the return stack pointer.

4. **Chain Cleanup**: If the terminated co-routine was blocking the cleanup of older co-routines, those may now be cleaned up as well in a chain reaction.

## Memory Management

### The Temporal Stack Principle

Tacit's co-routine memory management follows what we call the "temporal stack principle":

> Co-routines created more recently (higher on the stack) must complete before co-routines created earlier (lower on the stack) can be cleaned up.

This principle has several important implications:

1. **Natural Nesting**: It aligns with how tasks naturally nest within each other, where subtasks complete before their parent tasks.

2. **Fragmentation Prevention**: By enforcing a strict cleanup order, the system prevents fragmentation of the shared return stack.

3. **Predictable Lifetimes**: Developers can reason about co-routine lifetimes based on their creation hierarchy.

### Stack Frames and Variable Management

Each co-routine maintains its own stack frame on the shared return stack:

```
[Higher memory addresses]
+------------------+
| Buffer Area      | <- Space for buffers and private data stack
+------------------+
| Variable Table   | <- Co-routine local variables
+------------------+
| Frame Marker     | <- Identifies this as a co-routine frame
+------------------+
| State (IP/BP/RP) | <- Minimal state information
+------------------+
[Lower memory addresses]
```

The variable table and buffer area work exactly as they do in regular functions, using the same mechanisms for access and cleanup. This consistency makes co-routines a natural extension of Tacit's existing memory model rather than a separate system.

### Private Data Stacks

While co-routines share the return stack, each must maintain its own private data stack:

1. **Buffer Allocation**: During initialization, a buffer is allocated within the co-routine's stack frame.

2. **DP Redirection**: The data pointer (DP) is permanently redirected to this buffer.

3. **Independent Operations**: All data stack operations now work with this private stack, isolating the co-routine's work from other co-routines.

4. **Automatic Cleanup**: When the co-routine terminates, its private data stack is automatically cleaned up with the rest of its stack frame.

This approach provides data isolation without requiring separate memory allocation mechanisms.

## Communication Between Co-routines

### Message Passing

Co-routines communicate through message passing rather than shared memory:

1. **Channels**: Messages are sent and received through named or referenced channels.

2. **Rendezvous**: By default, communication is synchronous - a sending co-routine yields until a receiver accepts the message.

3. **Direct Transfer**: No copying of message data occurs; instead, direct references are exchanged.

### Channel Implementation

A channel in Tacit is an extremely lightweight structure:

1. **Waiting Points**: Simply tracks which co-routine (if any) is waiting at the channel.

2. **Message Location**: Defines a known location where a value can be transferred.

Buffering is typically unnecessary between co-routines since the lazy, synchronous nature of communication naturally regulates data flow. Buffering may only be needed for interfacing with external systems like user input or network communication.

### Send/Receive Operations

The communication model emphasizes simplicity and lazy operation:

1. **Send**: When a co-routine sends a message:
   - It writes the value to a known location
   - It immediately suspends execution (yields)
   - The scheduler activates the receiver if one is waiting
   - If no receiver is waiting, the sender remains suspended until a receiver arrives

2. **Receive**: When a co-routine wants to receive a message:
   - If a sender is waiting, it reads the value from the known location and makes the sender runnable
   - If no sender is waiting, it registers itself as waiting and suspends until a sender arrives

This lazy approach creates a natural flow control where operations happen exactly when needed. Since sending always yields, and co-routines are explicitly designed to handle this yielding behavior, the system remains simple and predictable without complex buffering or synchronization mechanisms.

## Scheduling

### The Scheduler

The co-routine scheduler in Tacit is remarkably simple:

1. **Run Queue**: Maintains a list of runnable co-routines.

2. **Simple Algorithm**: Selects the next runnable co-routine in a round-robin fashion.

3. **Idle Detection**: Enters an idle state when no co-routines are runnable.

4. **Event Integration**: Can be awakened by external events (I/O, timers, etc.).

### Advanced Scheduling

For more complex needs, the scheduler can be extended with:

1. **Priorities**: Assigning different priority levels to co-routines.

2. **Timeouts**: Allowing co-routines to sleep for specific durations.

3. **I/O Waiting**: Suspending co-routines until I/O operations complete.

4. **Custom Policies**: Implementing application-specific scheduling rules.

## Practical Examples

### Basic Co-routine

```
function counter() {
  var i = 0
  
  while (true) {
    print("Count: " + i)
    i = i + 1
    yield  // Pause here and let other co-routines run
  }
}

spawn_cr(counter)  // Create and schedule the co-routine
```

This simple example shows an infinite counter that yields after each increment, allowing other co-routines to run.

### Producer/Consumer Pattern

```
function producer(channel) {
  for (i = 0; i < 10; i++) {
    // Produce value
    value = calculate_something(i)
    
    // Send to channel (may yield if no receiver ready)
    send(channel, value)
  }
  
  // Signal end of production
  send(channel, null)
}

function consumer(channel) {
  while (true) {
    // Receive from channel (may yield if no sender ready)
    value = receive(channel)
    
    // Check for end of stream
    if (value == null) break
    
    // Process value
    process(value)
  }
}

// Create a channel
ch = create_channel()

// Spawn co-routines
spawn_cr(producer, ch)
spawn_cr(consumer, ch)
```

This example shows how co-routines can communicate through channels, creating a producer/consumer relationship.

## Performance Considerations

### When to Use Co-routines

Co-routines in Tacit are designed to be lightweight, but they're not free. Consider using co-routines when:

1. **Breaking up complex operations** that would otherwise block for too long
2. **Handling asynchronous operations** like I/O
3. **Modeling independent processes** that need to communicate
4. **Implementing state machines** with complex transitions

Avoid unnecessary use of co-routines for simple sequential operations where regular functions would suffice.

### Optimizing Co-routine Performance

1. **Minimize State**: Keep co-routine local variable usage minimal.
2. **Batch Work**: Do meaningful work between yields to amortize the cost of context switching.
3. **Consider Lifetimes**: Be mindful of the temporal stack principle when creating nested co-routines.
4. **Optimize Data Stack Size**: Size the private data stack appropriately for the co-routine's needs.

## Comparison with Traditional Concurrency Models

Tacit's co-routine system differs significantly from other concurrency approaches:

### vs. Preemptive Threading (e.g., POSIX threads, Java threads)

| **Tacit Co-routines** | **Preemptive Threading** |
|------------------------|---------------------------|
| Cooperative yielding at explicit points | Arbitrary preemption by scheduler |
| Shared memory with temporal guarantees | Shared memory requiring locks and synchronization |
| Minimal state (IP, BP, RP) | Complete thread context (all registers, stack, etc.) |
| No race conditions | Prone to race conditions |
| No deadlocks from mutual exclusion | Potential deadlocks |
| Deterministic execution order | Non-deterministic execution |
| Lightweight (bytes of overhead) | Heavy (kilobytes of overhead) |

### vs. Async/Await (e.g., JavaScript, C#)

| **Tacit Co-routines** | **Async/Await** |
|------------------------|------------------|
| First-class primitive in the language | Built on promises/futures |
| Direct stack-based implementation | Often requires heap allocations for continuations |
| Explicit channel-based communication | Typically callback or promise-chain based |
| Works identically for all operations | Often requires special async-aware libraries |
| No syntax transformation or state machines | Usually compiled to state machines |

### vs. Actor Model (e.g., Erlang, Akka)

| **Tacit Co-routines** | **Actor Model** |
|------------------------|----------------|
| Shared memory space | Isolated memory per actor |
| Direct communication via channels | Message passing via mailboxes |
| Scheduling within a single VM | Often distributed across nodes |
| Explicit control over yielding | Implicit yielding between messages |

The key advantage of Tacit's approach is achieving non-blocking concurrency with minimal conceptual overhead. Rather than layering concurrency on top of a sequential execution model, Tacit integrates it directly into the core language design, resulting in a system that is both simpler and more powerful.

## Conclusion

Tacit's co-routine system offers a powerful concurrency model that maintains the language's commitment to simplicity and efficiency. By leveraging the existing stack-based architecture and adding minimal state tracking, co-routines enable complex asynchronous operations without introducing the complexities of traditional threading models.

The temporal stack principle ensures memory integrity while the channel-based communication system provides clean isolation between co-routines. This combination results in a system that is both powerful and predictable, allowing developers to build sophisticated concurrent applications without sacrificing performance or readability.
