# Tacit: Task Policy Model

## Overview

Tacit tasks are designed to be pure, cooperative, and unaware of low-level control structures like `yield` or `next`. Instead, behavioral policies are provided at the time of spawning a task. This keeps task code clean, while allowing the runtime to enforce system-level concerns like fairness, responsiveness, and resource management.

## Task Policy Categories

### 1. Yield Policy

Determines how frequently a task yields control to the scheduler.

- Global default yield policy applies to all tasks.
- Per-task yield policy can override the default at spawn time.

Example policies:
- Yield every N iterations
- Yield after X milliseconds
- Manual / explicit yield only

### 2. Buffer Policies

Each task has an *inbox* (input buffer) by default.

Buffer policy controls include:
- Buffer Size (fixed power-of-2, e.g., 8 slots)
- Overflow Behavior:
  - Block (default for critical data)
  - Drop Oldest
  - Drop Newest
  - Error

- Timeliness vs Accuracy Tradeoffs:
  - Eager: Always push latest, possibly dropping older data
  - Reliable: Block until space is available

### 3. Additional Potential Policies

- Scheduling priority (background vs foreground)
- Resource limits (memory, CPU quotas)
- Auto-close behavior for inbox when task ends
- Auto-retry or backpressure strategies
- IO-specific policies (timeouts, batching)

## Buffer Implementation

Tacit uses a power-of-2 circular buffer model for all task inboxes. Each buffer is a fixed-size array (typically 8 slots) with `head` and `tail` pointers to track reading and writing positions.

- When the buffer is **empty**, `head` equals `tail`.
- When the buffer is **full**, advancing `tail` would overwrite `head`.

Push Behavior:
- If the buffer is full, the task yields *before* attempting the push.
- The push only proceeds if space is guaranteed.

Pop Behavior:
- If the buffer is empty, the task yields.
- Once resumed, the pop is guaranteed to succeed.

### Stack Ownership Guarantee

Tacit tasks own their own data stack completely. No other task or system operation can modify a task's stack while it is suspended. This means:

- Any value to be pushed into a buffer remains safely on the task’s stack if the buffer is full.
- Yielding happens *before* the buffer state changes.
- When the task is resumed, execution picks up exactly where it left off with the stack unchanged.
- The push or pop operation simply retries and succeeds when the buffer has available space.

## IO Task Model: stdin-task and stdout-task

Tacit treats standard input and output as first-class tasks within the system.

- `stdin-task` reads input (lines or signals like CTRL-C) from the outside world.
- It pushes these into `main-task`'s inbox buffer.
- `stdout-task` reads from its inbox and outputs to the terminal or log.

### Handling CTRL-C (Interrupt Signal)

- When `stdin-task` detects a CTRL-C event, it does not directly mutate `main-task`'s internal state.
- Instead, it pushes a special control message (e.g., `INTERRUPT`) into `main-task`'s inbox buffer.

### Benefits

- No task directly mutates another task’s internal fields.
- Signals and control are delivered purely through message passing.
- The main task decides how to handle its own lifecycle and exit conditions.
- Task isolation remains clean and robust.

## Advanced Signal Handling (Optional Future Feature)

Tacit may eventually support additional system or control signals such as:
- TERMINATE, PAUSE, RESUME, TIMEOUT, EOF, etc.

These signals would follow the same model:
- They are pushed as tagged values into task inboxes.
- Tasks interpret the signal value and respond as needed.

Signals can be represented as non-heap tagged values with a numeric payload, allowing tasks to pattern-match on signal type or code.

## Policy Application

Policies are provided at task creation (spawn time) as structured parameters.

Example:

```
printer spawn :yield-policy 100 :inbox-policy drop-oldest
```

## Key Principles

- Tasks themselves remain pure and unaware of policies.
- Policies govern runtime behavior only.
- Policies can be global defaults or per-task overrides.
- Buffer policies allow fine-grained control over dataflow and responsiveness.
- Buffer operations are atomic and task-safe: no retries or partial effects.
- Stack ownership by tasks ensures safe suspension and resumption without loss of data.
- Signal delivery and IO handling are message-driven, preserving task isolation.
- The model is extensible: new policies can be added over time without breaking the task model.

## REPL Task Lifecycle

The REPL (Read-Eval-Print Loop) in Tacit operates as a normal task, consistent with the general task model of inbox-driven communication and cooperative execution.

### Startup Sequence

At VM startup, the following tasks are spawned:
- `stdin-task`: Reads lines from terminal input and pushes them to `repl-task`'s inbox.
- `stdout-task`: Receives output messages from any task (typically `repl-task`) and prints them.
- `repl-task`: The main interactive task handling user input and executing Tacit code.

### REPL Task Behavior

```
(repl-task)
loop:
    repl-inbox buffer-pop → line

    if line == INTERRUPT then
        exit
    else
        parse line → program
        execute program inline
        send output to stdout-task's inbox
    endif

    yield
    goto loop
```

### Execution of Input Lines

- Lines are parsed into programs.
- Execution occurs inline within `repl-task`.
- Each line acts like a mini-program without requiring a separate task spawn.
- Errors during execution are caught and reported via `stdout-task`.
- The REPL continues running after handling errors.

### Handling Multi-line or Incomplete Input

- Parsing detects incomplete expressions (e.g., unmatched brackets).
- The REPL waits for additional input until the program is syntactically complete.
- Execution only begins after a complete input has been received.

### Termination Conditions

The REPL task may terminate by:
- Receiving an `INTERRUPT` signal (from `stdin-task` or system).
- Receiving EOF from `stdin-task` (e.g., Ctrl-D input).
- An explicit `exit` command issued by the user.
- An error condition resulting in an unrecoverable state (rare; most errors are recoverable).

### Post-Termination Behavior

- Upon REPL task termination, the VM may halt completely or continue running other tasks.
- The VM scheduler determines whether to remain idle, shut down, or spawn new tasks based on configuration.

## Canonical File Reader Task

Tacit's file reader pattern treats file reading as a cooperative task consistent with all other IO models.

### File Reader Task Behavior

- Spawned with a file handle and target task ID.
- Reads lines (or blocks) from the file.
- Pushes each line into the target task's inbox.
- Handles `EOF` or `TERMINATE` signals.

### File Reader Loop

```
(file-reader-task)
loop:
    if inbox has message then
        buffer-pop → msg
        if msg == TERMINATE then exit
    endif

    read-line-from-file → line-or-EOF

    if line-or-EOF == EOF then
        target-task-inbox buffer-push EOF
        exit
    else
        target-task-inbox buffer-push line-or-EOF
    endif

    yield
    goto loop
```

## Canonical File Writer Task

Tacit's file writer pattern mirrors the reader pattern.

### File Writer Task Behavior

- Spawned with a file handle.
- Waits for lines or blocks in its inbox.
- Writes each item to the file.
- Closes the file on receiving `EOF` or `TERMINATE`.

### File Writer Loop

```
(file-writer-task)
loop:
    buffer-pop → msg

    if msg == EOF or msg == TERMINATE then
        close-file
        exit
    else
        write-to-file msg
    endif

    yield
    goto loop
```

## Declarative Task Wiring Patterns

Tacit supports declarative task wiring using the same `:name ... ;` syntax used for function definitions. This allows users to construct reusable, stack-driven task pipelines in a familiar style.

Each `:task-name` definition spawns a cooperative task and leaves its task-id on the stack. This enables composition and wiring of input/output pipelines.

### Minimal REPL Setup

```
:stdin    stdin spawn ;
:stdout   stdout spawn ;
:repl     stdin stdout repl spawn ;
```

### File Pipeline Example

```
:reader   'input.txt file-read spawn ;
:writer   'output.txt file-write spawn ;
:copy     reader writer copy-lines spawn ;
```

Where `copy-lines` is a task that reads from reader's output and writes into writer's inbox, line by line.

### Transform Pipeline Example

```
:reader    'data.csv file-read spawn ;
:cleaner   reader map {parse-line} spawn ;
:writer    'cleaned.csv file-write spawn ;
:process   cleaner writer forward-lines spawn ;
```

### Benefits

- Fully declarative
- Easy to inspect and reuse
- Consistent with function definition syntax
- Naturally fits stack-based composition model
- Tasks can be started, wired, and managed just like other Tacit components

## Task Cleanup and Deferred Actions

Long-lived tasks in Tacit may manage external resources such as file handles, database connections, or network sockets. To ensure proper cleanup regardless of how a task terminates (normal exit, signal, or error), Tacit supports **deferred cleanup actions**.

### Concept

- A task may register one or more deferred cleanup actions.
- These are stored on a per-task cleanup stack.
- When the task exits for any reason, all deferred actions are run in reverse order (last-in, first-out).

### Benefits

- Ensures consistent resource cleanup.
- Keeps task logic clean and centralized.
- Eliminates scattered or duplicated `close` calls.

### Example 1: File Writer Task with Deferred Close

```
open-file → handle
handle defer-close-file

loop:
    buffer-pop → msg

    if msg == EOF or msg == TERMINATE then
        exit
    else
        write-to-file msg
    endif

    yield
    goto loop
```

### Example 2: Database Reader Task with Deferred Close

```
open-db-connection 'SELECT * FROM users' → db-handle
db-handle defer-close-db

loop:
    read-row-from-db db-handle → row-or-EOF

    if row-or-EOF == EOF then
        target-inbox buffer-push EOF
        exit
    else
        target-inbox buffer-push row-or-EOF
    endif

    yield
    goto loop
```

### Cleanup Stack Semantics

- Deferred actions are per-task and run at exit.
- Multiple deferred actions may be registered.
- Cleanup actions must be non-blocking and yield-friendly.
- Failures during cleanup do not prevent task exit but may emit error signals.

This model integrates cleanly into Tacit's cooperative task system, allowing robust external interaction without compromising system stability or simplicity.
