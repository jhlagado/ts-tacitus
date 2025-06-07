# Implementation Status: Implemented
- Core memory model: Implemented in `src/core/memory.ts`
- NaN-boxing for type safety: Implemented in `src/core/tagged.ts`
- Block reference counting: Implemented §1.1-1.3
- Related to [memory-management.md] for allocation strategy

# Tacit Memory Integrity & Stress Testing Plan (Full Detailed Edition)

This document provides a detailed and rigorous approach to validating the integrity of Tacit’s memory model, which is built around reference-counted, fixed-size heap blocks. The aim is to guarantee correctness, performance, and long-term reliability through stress testing, leak detection, and runtime validation.

---

## 1. Introduction & Scope

Tacit is a minimal stack-based language and runtime system that implements memory management through immutable data structures, structural sharing, and an explicit reference counting model. Memory allocation is organized into fixed-size 64-byte blocks, linked as needed to represent larger objects.

The goal of this document is to define a robust set of mechanisms for validating memory correctness, preventing leaks, monitoring heap activity, and verifying the consistency of data structures over time.

### 1.1 Core Heap Model

- Fixed Block Size: All heap allocations are in 64-byte chunks. Blocks are aligned, and allocation granularity is not variable. Every object, no matter how large, is composed of one or more of these blocks linked by `BLOCK_NEXT`.
- Headers: Each block begins with 4 bytes of metadata.
  - `BLOCK_NEXT` (2 bytes): Index of the next block in the chain.
  - `REF_COUNT` (2 bytes): Number of live references to the chain (stored in the head block only).
- Payload: The remaining 60 bytes are usable by the object.

This simple structure eliminates fragmentation, makes memory traversal predictable, and allows reuse of blocks with low bookkeeping cost.

### 1.2 Allocation and Deallocation Semantics

Allocations are performed by `malloc(size)`, which consumes enough free blocks to store `size` bytes. These blocks are linked together, and the chain is terminated with `BLOCK_NEXT = INVALID`.

Reference counting is handled explicitly. Each object is initialized with a reference count of 1. When a reference is retained (e.g., inserted into a vector or dictionary), the ref count is incremented. When it is removed or goes out of scope, the ref count is decremented. When the count reaches zero, the entire chain is returned to the free list.

### 1.3 Copy-On-Write (COW)

Tacit’s containers (vectors, dictionaries) are immutable. Updates to a shared object use a copy-on-write model:

- If the object’s `REF_COUNT` > 1, a new copy of the affected block(s) is created.
- If the object’s `REF_COUNT` == 1, it is safe to modify in-place.

This ensures safety and determinism when structures are reused or passed between functions.

### 1.4 Sequence Model

Sequences are a special kind of heap object that represent lazily computed data streams. They are implemented as:

- A small cursor block that stores:
  - The sequence type (e.g., range, map, filter, join)
  - A pointer to the source sequence
  - Internal state (like index or current value)
- The sequence is advanced by calling `next`, which updates the state in-place.

Sequences are typically short-lived and require precise management to avoid leaks.

---

### 1.5 Monitoring Objectives

To ensure the memory system is functioning correctly, the following aspects must be monitored and tested:

1. Reference Count Accuracy  
   Every increment must be matched by a corresponding decrement. Reference counts should never go negative, and double frees must not occur.

2. Leak Detection  
   After a computation is complete, all temporary objects should be released. Long-lived objects should have a verifiable ownership trail.

3. Ownership Graph Consistency  
   The structure of heap pointers (between blocks and between sequences) must form a directed acyclic graph. Cycles are prohibited by construction.

4. Heap Snapshot Validation  
   Snapshots of the heap’s state should be comparable. Differences should explainable by allocations or frees. Snapshots help detect stale blocks.

5. Stress Load Resilience  
   Under high allocation pressure, the system should not degrade or leak. Performance and integrity must remain stable with thousands of operations per second.

6. Copy-On-Write Integrity  
   When a block with `REF_COUNT > 1` is about to be modified (e.g., `vectorSet`), it is cloned.

---

### 1.6 Terminology

| Term              | Definition                                                                 |
|-------------------|----------------------------------------------------------------------------|
| Block             | A 64-byte unit of heap memory                                              |
| Chain             | A sequence of blocks linked by `BLOCK_NEXT`                               |
| Head Block        | The first block in a chain, where `REF_COUNT` is stored                   |
| COW               | Copy-on-write; creating a copy of shared data to perform safe mutation    |
| Cursor            | A sequence-specific block holding its iteration state                     |
| Snapshot          | A frozen view of the heap’s live and free blocks                          |
| Free List         | A singly linked list of all unallocated blocks                            |

---

### 1.7 Implementation Constraints

Tacit runs on minimal platforms (e.g., embedded or WebAssembly VMs), so the monitoring and testing tools must:

- Impose zero overhead in production mode
- Operate with bounded memory when enabled
- Work with the existing ref-count model (no GC)
- Avoid runtime allocations for logging and diagnostics

---

This completes Section 1.

Line count so far: ~110 lines.

Let me know when you're ready for Section 2: *Memory Model Implementation*.

### Section 2: Memory Model Implementation

This section outlines the precise data layout and operational behavior of Tacit's heap memory model, including block structure, allocation strategies, chain manipulation, and deallocation procedures. All details reflect the use of 64-byte aligned memory blocks, fixed headers, and strict structural sharing rules.

---

#### 2.1 Block Layout

Each memory block is exactly 64 bytes in size. The first 4 bytes are reserved for metadata. The remaining 60 bytes are the usable payload.

Block Structure:
```
Offset  Size  Field         Description
------  ----  ------------  -----------------------------------------------
0x00    2 B   BLOCK_NEXT    Index of next block in chain, or 0xFFFF (INVALID)
0x02    2 B   REF_COUNT     Reference count (only valid in head block)
0x04    60 B  PAYLOAD       Data or child pointers (varies by structure type)
```

Constants:
- `BLOCK_SIZE = 64`
- `HEADER_SIZE = 4`
- `USABLE_BLOCK_SIZE = 60`
- `INVALID = 0xFFFF`

Blocks are addressed by index, not byte offset. The heap segment is divided evenly into `N = HEAP_SIZE / BLOCK_SIZE` blocks. Byte offsets are computed as `block_index * 64`.

---

#### 2.2 Free List Management

The heap maintains a singly linked free list using the `BLOCK_NEXT` field. On initialization, all blocks are free and linked in a chain.

- `Heap.freeList` points to the head of the list.
- To allocate, blocks are popped from the free list.
- To deallocate, blocks are pushed to the front of the free list with `BLOCK_NEXT` set to the previous head.

Free List Invariants:
- Every block in the free list has `REF_COUNT = 0`.
- No cycles are permitted in the free list.
- The list terminates with `BLOCK_NEXT = INVALID`.

---

#### 2.3 Block Allocation (malloc)

Allocating an object of size `n` bytes requires `ceil(n / 60)` blocks.

Algorithm:
1. Check if enough blocks are available.
2. Pop each required block from the free list.
3. Link blocks with `BLOCK_NEXT`.
4. Set `REF_COUNT = 1` in the head block.
5. Set `BLOCK_NEXT = INVALID` in the last block.

If allocation fails midway, all acquired blocks are returned to the free list (rollback).

Sample Pseudocode:
```ts
function malloc(size: number): number {
  const needed = Math.ceil(size / USABLE_BLOCK_SIZE);
  let head = INVALID, tail = INVALID;

  for (let i = 0; i < needed; i++) {
    const block = popFreeList();
    if (block === INVALID) {
      rollback(head); return INVALID;
    }
    if (head === INVALID) head = block;
    else setNext(tail, block);
    tail = block;
  }
  setNext(tail, INVALID);
  setRefCount(head, 1);
  return head;
}
```

---

#### 2.4 Deallocation (decrementRef)

When a structure is no longer referenced, its `REF_COUNT` is decremented. If it reaches 0, the entire chain is returned to the free list.

- The function recurses through the chain using `BLOCK_NEXT`.
- All blocks are individually freed.
- Cycles cannot occur due to immutability and one-directional links.

Pseudocode:
```ts
function decrementRef(block: number): void {
  if (block === INVALID) return;
  const count = getRefCount(block);
  if (count > 1) {
    setRefCount(block, count - 1);
  } else {
    let next = getNext(block);
    addToFreeList(block);
    decrementRef(next);
  }
}
```

---

#### 2.5 Reference Count Management

Only the head block of a chain tracks the reference count. The `incrementRef` and `decrementRef` operations must only be applied to head blocks.

Constraints:
- `incrementRef` must not overflow (`0xFFFF` is reserved).
- `decrementRef` must not underflow (`<0`).
- Any attempt to manipulate non-head blocks is undefined behavior.

Diagnostics:
- In debug mode, validate that `decrementRef` is never called on a block with `REF_COUNT == 0`.
- Hooks can log all changes to monitor for mismatches.

---

#### 2.6 Chain Manipulation

Tacit supports pointer chains via the `BLOCK_NEXT` field, which enables larger objects (like long vectors or sequences) to be split across multiple blocks.

- All blocks after the head have `REF_COUNT = 0`.
- These blocks are owned by the head and released together.
- Blocks must not be re-used or re-linked outside of their original allocation chain.

---

#### 2.7 Copy-On-Write Semantics

When a block with `REF_COUNT > 1` is about to be modified (e.g., `vectorSet`), it is cloned.

1. `cloneBlock()` copies the full block and resets `REF_COUNT = 1`.
2. If the block has a child via `BLOCK_NEXT`, the child’s `REF_COUNT` is incremented.
3. The reference to the old block is decremented.

Pseudocode:
```ts
function copyOnWrite(block: number, prev?: number): number {
  if (getRefCount(block) <= 1) return block;
  const newBlock = cloneBlock(block);
  if (prev !== undefined) setNext(prev, newBlock);
  decrementRef(block);
  return newBlock;
}
```

---

#### 2.8 Garbage Safety Invariants

The memory model guarantees safety by ensuring:

- All `malloc` chains terminate with `INVALID`.
- No block has both `REF_COUNT > 0` and presence on the free list.
- Reference counts match the number of incoming references at all times (verifiable via graph analysis).
- Sequences and containers never share internal blocks unless intended.

---

#### 2.9 Summary of Heap Functions

| Function         | Purpose                               |
|------------------|----------------------------------------|
| `malloc(n)`      | Allocates enough blocks to hold `n` bytes |
| `free(b)`        | Frees the block chain starting at `b`     |
| `incrementRef(b)`| Increments `REF_COUNT` of head block     |
| `decrementRef(b)`| Decrements and possibly frees chain      |
| `setNext(a, b)`  | Sets `BLOCK_NEXT` of block `a` to `b`    |
| `cloneBlock(b)`  | Returns a fresh copy of block `b`        |

Excellent. Here's the full Section 3: Monitoring & Validation Infrastructure, with complete detail and consistent structure. This section lays out the tools, hooks, and data models used to verify the integrity of Tacit’s heap in real time and during tests.

---

### Section 3: Monitoring & Validation Infrastructure

This section defines the tools and mechanisms that monitor heap behavior, validate reference counts, detect leaks, and enforce safety invariants in Tacit’s memory model. These features can be activated selectively in debug builds or during automated testing and are designed to operate with low overhead and high confidence.

---

#### 3.1 Snapshot System

The snapshot system captures a consistent view of the heap state at a specific point in time.

Purpose:
- Track allocations before and after operations
- Compare snapshots to detect memory leaks
- Verify that all expected deallocations occurred

Structure:
```ts
interface HeapSnapshot {
  timestamp: number;
  allocatedBlocks: Map<number, number>; // block index → ref count
  freeListHead: number;
  totalFree: number;
}
```

Usage:
- `captureSnapshot()` stores the current heap state
- `compareSnapshots(before, after)` returns:
  - Blocks newly allocated
  - Blocks not properly freed
  - Blocks whose `REF_COUNT` changed unexpectedly

Lineage Tracking (Optional):
- Snapshots may include `allocationSite` metadata in debug builds
- Used to trace the origin of leaked blocks

---

#### 3.2 Event Logging

To aid in debugging and understanding reference flow, Tacit logs all reference operations when audit mode is enabled.

Structure:
```ts
interface LogEntry {
  block: number;
  oldRefCount: number;
  newRefCount: number;
  operation: 'malloc' | 'incRef' | 'decRef' | 'free';
  timestamp: number;
  caller?: string;
}
```

Ring Buffer:
- Fixed-size circular buffer (e.g. 1024 entries)
- Overwrites oldest entries once full
- Accessible via `exportLog()` for external review

Logging Functions:
- `logMalloc(block)`
- `logRefChange(block, from, to, opType)`
- `logFree(block)`

Performance Considerations:
- Logging can be sampled (e.g., log every 10th event)
- In production, logging is disabled entirely

---

#### 3.3 Shadow Reference Counter

The shadow ref counter system maintains a mirror of `REF_COUNT` values and verifies they remain consistent with expected operations.

Implementation:
```ts
shadowCounts: number[]; // index matches heap block index
```

Updates:
- Every `incrementRef` and `decrementRef` modifies both the real count and the shadow count
- At checkpoints, `shadowCounts[i] === getRefCount(i)` must hold

Debug Mode Enforcement:
- Assertions trigger fatal errors if mismatches occur
- Optional: store stack traces or call site IDs in a parallel array for diagnostics

---

#### 3.4 Ownership Graph Analysis

A complete representation of object relationships can be constructed by analyzing heap contents.

Graph Nodes:
- Each allocated block with `REF_COUNT > 0`

Graph Edges:
- For each pointer in a block’s payload, add an edge from parent to child

Analysis Goals:
- Validate acyclicity (no heap cycles)
- Compute in-degree for every block and compare to `REF_COUNT`
- Identify dangling references (pointers to freed blocks)

Cycle Detection:
- Run depth-first traversal from every live root
- Flag back-edges as violations

Example Output:
```json
{
  "block": 37,
  "expectedRefs": 3,
  "actualRefs": 2,
  "diagnostics": ["missing parent: block 42"]
}
```

---

#### 3.5 Hook System

A flexible auditing framework allows observers to subscribe to memory events.

Usage:
```ts
registerAuditHook('malloc', fn)
registerAuditHook('incRef', fn)
registerAuditHook('decRef', fn)
registerAuditHook('free', fn)
```

Hook Signature:
```ts
function onRefChange(block: number, from: number, to: number): void;
```

Use Cases:
- Logging
- Snapshot capture
- Integrity assertions
- Heap metric tracking

Performance:
- Disabled by default
- Internally guarded with `if (hooksEnabled) { ... }`

---

#### 3.6 Heap Metric Collection

Tacit can maintain global statistics about heap usage for profiling and development insight.

Collected Stats:
- `totalAllocated`: number of allocations since boot
- `totalFreed`: number of blocks freed
- `peakUsage`: maximum number of live blocks at any time
- `currentlyInUse`: current count of allocated blocks
- `refCountHistogram`: map of ref count → block count

Export Format:
```ts
interface HeapStats {
  totalAllocated: number;
  totalFreed: number;
  currentlyInUse: number;
  peakUsage: number;
  refCountHistogram: Map<number, number>;
}
```

Periodic Dumping:
- Stats can be logged every N seconds or after M operations
- Optionally exposed to external systems via `console.log` or Prometheus text format

---

#### 3.7 Validation APIs

All validation tools are exposed via clear programmatic interfaces.

Available Functions:
- `captureSnapshot(): HeapSnapshot`
- `compareSnapshots(before, after): HeapDelta`
- `runOwnershipCheck(): ValidationReport`
- `validateRefCounts(): boolean`
- `exportRefGraph(): Graph`
- `registerAuditHook(event, fn): void`
- `exportHeapStats(): HeapStats`

These can be invoked interactively or embedded into test cases.

Awesome. Here's Section 4: Stress Testing Scenarios, fully detailed and consistent with the previous sections. This section outlines how Tacit’s memory system is tested under extreme, varied, and realistic workloads.

---

### Section 4: Stress Testing Scenarios

Tacit's memory system is designed to support immutable structures with reference counting and copy-on-write. To ensure its correctness and resilience under high load, a series of stress testing scenarios have been developed. These scenarios simulate common and edge-case workloads, focusing on allocation pressure, sequence composition, and nested structures.

Stress testing is central to revealing:
- Reference leaks
- Improper deallocations
- Over-retention
- Unexpected performance regressions

---

#### 4.1 Vector Stress Scenarios

Vectors are frequently used for both internal operations and user data. These tests explore how nested and updated vectors behave under load.

##### 4.1.1 Deep Nesting

- Goal: Create thousands of vectors where each vector contains another.
- Test:
  - Create a vector `V₀` containing a number.
  - Iteratively build `V₁ = [V₀]`, `V₂ = [V₁]`, ..., `Vₙ = [Vₙ₋₁]`.
  - At each step, verify reference count of all layers.
- Cleanup: Free only the top-level vector and ensure cascading deallocation occurs.
- Expected: No leaks, all inner blocks freed once outer is dereferenced.

##### 4.1.2 Fan-Out Tree

- Goal: Verify copy-on-write behaves correctly across multiple shared subtrees.
- Test:
  - Build a base vector and reuse it across multiple parents.
  - Mutate one parent to trigger COW.
  - Confirm only mutated branches are cloned.
- Validation: Use shadow ref counts to verify no blocks are over-retained.

##### 4.1.3 Vector Slicing Loop

- Goal: Stress test vector slicing and partial views.
- Test:
  - Generate a long vector.
  - Repeatedly slice it into shorter sub-vectors (e.g., sliding window).
  - Dispose each slice after processing.
- Expected: All slices share the base vector until mutated or freed.

---

#### 4.2 Sequence Chain Tests

Lazy sequences create temporary blocks that must be correctly freed. These tests ensure sequence disposal works recursively across chains.

##### 4.2.1 Chain of Mappings

- Goal: Compose a pipeline of `map`, `filter`, `take` over a base `range`.
- Test:
  - Construct `S = range → map (×2) → filter (even) → take(100)`.
  - Fully iterate using `next()` until exhausted.
  - Dispose of the final sequence.
- Validation: Confirm that `range`, `map`, and `filter` blocks are released.

##### 4.2.2 Sequence Reuse

- Goal: Ensure sequences can be used once and then discarded safely.
- Test:
  - Create a map sequence `S₁` and consume it.
  - Attempt to consume `S₁` again.
  - Ensure it returns NIL immediately and does not crash.
- Validation: Final ref count of `S₁` and its children must be zero.

##### 4.2.3 Alternating Consumers

- Goal: Mix consuming and cloning of sequences.
- Test:
  - Build a base sequence `S`.
  - Clone `S` multiple times for different branches.
  - Let one consume fully, and the others partially.
- Validation: Ensure ref counts decrement correctly in each path.

---

#### 4.3 Dictionary & Structure Composition

Tacit uses dictionaries as its core key-value representation. These scenarios test memory behavior when constructing and mutating nested dictionaries.

##### 4.3.1 Shallow Merge Storm

- Goal: Repeatedly merge dictionaries, each with small payloads.
- Test:
  - Create thousands of `{a: x}` dicts.
  - Merge them into a cumulative object.
- Validation:
  - Verify COW kicks in correctly.
  - Ensure inner dicts are retained only once.

##### 4.3.2 Structural Sharing Graph

- Goal: Build a graph-like structure via nested dicts.
- Test:
  - Create `D₁ = {a: 1}`, `D₂ = {b: D₁}`, `D₃ = {c: D₂}`, etc.
  - Alter `D₃`, observe that `D₁` and `D₂` are unaffected.
- Expected: Only directly mutated structures are cloned.

---

#### 4.4 Mixed Workload Simulation

Combines vectors, sequences, and dictionaries into randomized interactions.

##### 4.4.1 Allocation Mix Test

- Goal: Simulate real-world usage by mixing types.
- Test:
  - Allocate a mix of random vectors, sequences, and dicts.
  - Perform updates, copies, and disposals in random order.
- Validation:
  - Snapshots taken periodically.
  - Run heap graph analysis to ensure integrity.

##### 4.4.2 Sliding Window with History

- Goal: Simulate a real-world scenario like a table filter.
- Test:
  - Generate a sequence of rows.
  - Use `filter` and `scan` to compute rolling aggregates.
  - Store intermediate results in vectors.
- Validation: Check that temp results do not leak after window slides forward.

---

#### 4.5 Duration and Load Parameters

All stress tests can be parameterized to run at scale.

| Parameter         | Description                                    |
|------------------|------------------------------------------------|
| `iterations`      | Number of test rounds                          |
| `maxVectorSize`   | Maximum length of any vector                   |
| `chainDepth`      | Maximum nesting depth for sequences or dicts   |
| `allocationRate`  | Number of allocations per test tick            |
| `disposalPolicy`  | Strategy: immediate, delayed, batched          |

---

#### 4.6 Validation Hooks for Stress Runs

Every test uses validation checkpoints:

- Snapshot before and after
- Event log delta comparison
- Ownership graph check
- Shadow ref count assertions
- Block reuse confirmation

Errors are immediately reported with block IDs, call site (if available), and expected vs. actual ref count.

Awesome. Here's Section 5: Integrity Hardening Techniques, in full detail and style-matched to the rest of the plan. This section introduces additional mechanisms—both runtime and design-time—that reinforce Tacit’s memory correctness guarantees beyond basic ref counting and snapshots.

---

### Section 5: Integrity Hardening Techniques

While reference counting and snapshots provide the foundation for memory validation in Tacit, additional safeguards can reinforce trust in the system—especially during debugging, testing, or mission-critical operation. This section outlines optional mechanisms for ensuring consistency, preventing misuse, and detecting anomalies.

These strategies are defensive in nature: they don't change the core memory model but act as safety rails and verification tools that help identify corruption, misuse, or performance regressions early.

---

#### 5.1 Runtime Integrity Checks

Tacit supports optional runtime assertions that enforce strict correctness across core memory operations.

##### 5.1.1 Free List Assertions

- Check: Every block in the free list must have `REF_COUNT == 0`.
- Violation: Any block with `REF_COUNT > 0` in the free list signals a serious corruption bug.
- Implementation: Validate during every `malloc()` and periodically via background checker.

##### 5.1.2 Block Boundary Validation

- Ensure that all block references are aligned and within bounds.
- Prevent pointer arithmetic or external memory reads from introducing invalid block references.
- Check `BLOCK_NEXT` values point to known valid block indices or `INVALID`.

##### 5.1.3 REF_COUNT Guardrails

- No block may exceed `REF_COUNT == 0xFFFE`. `0xFFFF` is reserved as invalid or corrupted.
- No block may be decremented below zero.
- In debug mode, these constraints are checked on every operation.

---

#### 5.2 Shadow Audit Mode

Shadow mode enables a parallel tracking system for all heap blocks without altering behavior. It validates that every `incrementRef` and `decrementRef` call is matched and consistent.

##### 5.2.1 Components

- `shadowRefs[blockIndex]`: Integer array of expected reference counts.
- Updated in parallel with every heap operation.
- Compared to actual `REF_COUNT` periodically.

##### 5.2.2 Snapshot Validation

- In debug test harnesses, `shadowRefs` are compared to a fresh heap snapshot.
- Any mismatch triggers a fatal validation failure with diagnostic info.

##### 5.2.3 Use Cases

- CI enforcement (test fails on mismatch)
- Memory leak testing
- Lifecycle testing for complex sequence and vector behavior

---

#### 5.3 Heap Consistency Validator

Runs deep inspection of the heap graph.

##### 5.3.1 Checks Performed

- All active chains terminate at `INVALID`.
- All shared blocks have accurate incoming edge counts.
- No chain contains loops or back-references.

##### 5.3.2 Techniques

- Traverse heap as a graph with block indices as nodes.
- Edges come from `BLOCK_NEXT` and any pointer values in payloads.
- Detect cycles via DFS and visited set.

##### 5.3.3 On Failure

- Dump diagnostic graph (`DOT` format or JSON).
- Include failing block index, incorrect ref count, and parents.
- Optionally export full heap snapshot for offline triage.

---

#### 5.4 Allocation Site Tracking (Debug Mode Only)

To assist with leak detection, Tacit can optionally annotate each allocation with a pseudo stack trace or site identifier.

##### 5.4.1 How It Works

- Every `malloc()` includes a string or numeric site code.
- Stored in a side map `Map<blockIndex, siteID>` (not in the block itself).
- When a leak is detected, you can trace its origin.

##### 5.4.2 Storage & Overhead

- This data is only enabled during development.
- Total memory use is small—one entry per allocated chain.
- Cleaned up alongside block deallocation.

---

#### 5.5 Audit Hooks and Interceptors

Audit hooks allow arbitrary user code or test code to intercept memory operations without patching core logic.

##### 5.5.1 Supported Hooks

```ts
registerAuditHook('malloc', (block) => {...});
registerAuditHook('incRef', (block, old, new) => {...});
registerAuditHook('decRef', (block, old, new) => {...});
registerAuditHook('free', (block) => {...});
```

##### 5.5.2 Hook Behavior

- Multiple hooks may be registered per event.
- Execution order is deterministic (FIFO).
- Hooks may log, validate, or set breakpoints.

##### 5.5.3 Performance Controls

- Hooks are disabled in production.
- In debug builds, overhead is measurable but bounded.
- All hook invocations are safe (cannot panic the VM).

---

#### 5.6 Leak Guard Timeout and Watchdog

In long-running programs, leak guards can periodically verify that memory usage remains bounded.

##### 5.6.1 Watchdog Process

- Background thread or cooperative timer checks heap stats every T seconds.
- If heap usage exceeds expected thresholds, it dumps a snapshot and logs the anomaly.

##### 5.6.2 Triggers

- Heap grows above `HIGH_WATERMARK`
- Free list drops below `MIN_FREE_BLOCKS`
- Allocation rate exceeds baseline average

##### 5.6.3 Remediation

- The system can enter fail-safe mode.
- Optionally throttle execution or refuse further allocations.
- Send telemetry or logs to external system.

---

#### 5.7 Optional Soft Limit and Quotas

Tacit allows programs to set soft memory quotas or thresholds to prevent overuse of heap space.

##### 5.7.1 User-Defined Limits

- Call `setHeapQuota(limit: number)` to register a max allocation threshold.
- Once reached, any `malloc()` call fails unless explicitly marked as “critical.”

##### 5.7.2 Use Cases

- Sandboxed script runners
- Multi-tenant environments
- Predictable low-latency systems

Perfect. Here’s Section 6: Implementation Roadmap, laying out a phased, concrete path to roll out everything we’ve discussed—from memory instrumentation to full leak protection, validation, and test integration.

---

### Section 6: Implementation Roadmap

This section outlines the recommended steps to fully implement the Tacit memory integrity strategy. It is structured in progressive stages, beginning with foundational audit tools and ending with fully integrated validation within development pipelines and CI systems.

Each phase is designed to build on the last, allowing incremental rollout, real-world testing, and immediate benefits without requiring wholesale rewrites.

---

#### 6.1 Phase 1: Core Audit Infrastructure (Week 1–2)

##### 6.1.1 Goals
- Enable capture of heap snapshots
- Track reference changes
- Lay the groundwork for leak detection and validation

##### 6.1.2 Tasks
- Implement `captureSnapshot()` and `compareSnapshots()`
- Build `incrementRef`/`decrementRef` wrappers with optional logging
- Add ring buffer for audit logs (`logRefChange`)
- Implement memory event hooks (`registerAuditHook`)

##### 6.1.3 Deliverables
- Snapshot diffing tool
- Log export tool
- Basic CLI validator (`checkRefs`, `showLeaks`, etc.)

---

#### 6.2 Phase 2: Shadow Reference Counter (Week 3)

##### 6.2.1 Goals
- Detect over- or under-decrement bugs with precision
- Ensure internal ref-count consistency

##### 6.2.2 Tasks
- Create `shadowRefs[]` array mirroring heap
- Hook into every `incRef` / `decRef` call
- Add `validateRefCounts()` utility
- Allow snapshots to compare live vs. shadow counts

##### 6.2.3 Deliverables
- Debug build with shadow tracking enabled
- Tests that fail on ref-count mismatch
- Leak summary reporter

---

#### 6.3 Phase 3: Heap Graph & Structural Analysis (Week 4–5)

##### 6.3.1 Goals
- Build a true ownership graph of the heap
- Detect cycles and reference mismatches

##### 6.3.2 Tasks
- Create graph builder using `BLOCK_NEXT` and payload inspection
- Traverse graph and compute in-degrees
- Compare computed in-degree to `REF_COUNT`
- Add `exportRefGraph()` and `runOwnershipCheck()`

##### 6.3.3 Deliverables
- DOT-format graph exports
- Diagnostic report for every mismatch
- Optional: Heap visualizer (in browser or CLI)

---

#### 6.4 Phase 4: Sequence-Specific Lifecycle Tests (Week 6)

##### 6.4.1 Goals
- Confirm that chained sequences clean up fully
- Ensure temporary sequence processors don’t leak

##### 6.4.2 Tasks
- Build sample pipelines (`range → map → filter → take`)
- Instrument with snapshots before and after consumption
- Add disposal hooks (`disposeSeq`) and validate full cleanup

##### 6.4.3 Deliverables
- Test cases with `detectLeaks(() => { ... })`
- Verification of temporary block deallocation
- Stress case: reuse sequences across branches

---

#### 6.5 Phase 5: CI Integration & Leak Gates (Week 7)

##### 6.5.1 Goals
- Prevent regressions in memory safety
- Validate correctness on every pull request

##### 6.5.2 Tasks
- Add heap integrity test to unit test suite
- Enable memory validation in CI
- Fail builds on memory growth, leaked blocks, or ref mismatches
- Add heap quota enforcement (opt-in)

##### 6.5.3 Deliverables
- CI reports: `Heap clean ✓`, `Leaks: 0 ✓`, `Graph valid ✓`
- Nightly runs of full audit suite
- Memory growth regression alerts

---

#### 6.6 Phase 6: Performance Tuning & OOM Handling (Week 8)

##### 6.6.1 Goals
- Ensure audit features remain fast and bounded
- Add recovery mechanisms under low memory conditions

##### 6.6.2 Tasks
- Add sampling to logs and shadow tracking
- Set soft memory quota
- Implement `onAllocationFailure()` for graceful fallback

##### 6.6.3 Deliverables
- Audit mode overhead < 5% in benchmarks
- Stable operation under high allocation load
- Warning logs on near-OOM conditions

---

#### 6.7 Phase 7: Documentation, Education, & Developer Support (Week 9)

##### 6.7.1 Goals
- Make memory model accessible to contributors
- Reduce bugs through clarity and training

##### 6.7.2 Tasks
- Write developer documentation for memory rules
- Include examples of correct reference handling
- Document sequence disposal patterns
- Create “common mistakes” reference guide

##### 6.7.3 Deliverables
- `memory.md` developer guide
- Internal tech talk or workshop slides
- Example-based tutorials and memory tests

---

### Long-Term Extensions

Even after the roadmap is complete, Tacit’s memory system can be expanded with features like:

- Live Heap Monitor: CLI tool that tracks and displays heap usage live.
- Deferred Collection (Experimental): Track unreachable chains and clean them lazily.
- Symbolic Site IDs: Tag allocations with human-readable tags for easier debugging.
- Leak Budgeting: Allow controlled leakage with periodic cleanup.

Great, here’s the final piece—Section 7: Summary & Conclusion. This wraps up everything we’ve laid out and sets the stage for using Tacit’s memory system in real, long-running, and mission-critical deployments.

---

### Section 7: Summary & Conclusion

Tacit’s heap model—centered on 64-byte fixed blocks, reference counting, and immutable data with structural sharing—offers simplicity, determinism, and performance. But correctness doesn’t happen automatically. This plan provides a complete strategy for turning Tacit’s low-level memory model into a robust, production-ready foundation.

---

#### 7.1 What We’ve Built

This document defines a full-spectrum integrity and validation framework:

- Block-level correctness via reference counting, COW, and chain allocation
- Leak detection through snapshots, shadow counters, and event logs
- Ownership verification with full heap graph analysis
- Stress testing across nested vectors, sequence chains, and dictionary merges
- Hardening techniques like quota enforcement, hookable memory ops, watchdogs, and audit logs
- Implementation roadmap guiding incremental, validated rollout
- Developer support via documentation, CI enforcement, and tooling

These tools, once implemented, turn every program written in Tacit into an audit-ready system. Failures become explainable. Bugs become reproducible. Leaks become impossible to ignore.

---

#### 7.2 Design Strengths of the Memory Model

The following principles are what make Tacit’s memory model uniquely suited to verification:

- Immutable by default: There are no in-place changes to user data structures unless uniquely owned.
- Explicit ownership: Reference counts are not magical—they are manipulated through clear, consistent mechanisms.
- Non-cyclical structure: Cycles are prohibited by design, removing an entire class of GC complexity.
- Fixed-size blocks: There’s no fragmentation, and every structure is composed from predictable parts.
- Linear traversal model: Chains are acyclic, singly linked, and cleanly terminated.

These constraints are not limitations—they are what allow the level of verification described in this plan.

---

#### 7.3 Future-Proofing Considerations

As Tacit evolves, new requirements may emerge:

- More complex object graphs
- Shared pools or caches of data
- Mutable user-defined memory models

This plan is designed to scale. The validator doesn’t assume a particular object type. The audit hooks are agnostic to structure. The graph builder doesn’t care whether a block belongs to a vector, dict, or sequence—it just analyzes what’s live and what’s referenced.

---

#### 7.4 Philosophical Note on Determinism

Tacit’s refusal to use garbage collection isn’t just about performance—it’s a philosophical commitment. Reference counts and copy-on-write offer a high-integrity memory model that can be validated, explained, and trusted. It may cost more thought during design, but the result is a system that gives up no control and hides no state.

Every leak is detectable. Every allocation is traceable. Every error is deterministic.

---

### ✅ Final Summary

You now have a complete, technically sound, implementation-ready plan for:

- Designing memory-safe objects in Tacit
- Validating correctness automatically
- Detecting and diagnosing memory leaks
- Stress-testing your system under complex workloads
- Scaling the memory model to real-world usage

This is not just an optimization plan or a test harness—it is a blueprint for making Tacit’s memory system one of the most rigorously verifiable reference-counted runtimes in existence.

Let this document serve as both foundation and contract: if we build this, we build it right.
