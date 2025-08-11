# Future Enhancements

This document captures potential improvements that are intentionally deferred. It is not a commitment, but a curated list to guide future work.

## Comparator safety and ergonomics

- Comparator arity checks
  - Problem: sort/mapsort/bfind assume comparator pushes exactly one NUMBER result; incorrect arity leaks stack or crashes
  - Proposal: before each comparator call, snapshot stack depth; after call, assert exactly one NUMBER was pushed; otherwise raise descriptive error
  - Scope: `sort`, `mapsort`, `bfind` (list and maplist variants)

- Comparator result validation
  - Problem: non-number comparator results lead to undefined behavior
  - Proposal: enforce numeric result; raise descriptive error (retain as hard error, not NIL)

- Optional comparator libraries
  - Provide standard comparators (numeric ascending/descending, length-based) as reusable words

## Address model consistency

- Unified address tagging
  - Consider dedicated ADDRESS tag vs current INTEGER SP-relative approach
  - Pros: type safety; Cons: tag budget; Decision deferred

## Access combinators

- set empty-path behavior
  - Decision pending: should `set` with an empty path mutate a simple value or always fail? Currently unspecified; document once chosen

## Hash index lifecycle

- Index invalidation
  - Detect structural changes to source maplist (length) and invalidate index
  - Optional checksum in index metadata to detect mismatches

## Performance notes

- Append optimization
  - Explore amortized strategies for repeated appends (builder buffers) while preserving stack semantics

