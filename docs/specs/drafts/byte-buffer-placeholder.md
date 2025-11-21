# Draft Plan — Byte-Based Buffer Rework (Placeholder)

> Status: DRAFT / Placeholder
> Scope: Define how a byte-addressable buffer should be designed, integrated, and tested in Tacit.

## Intent
- Capture the need for a byte-based buffer (as opposed to the current cell/tag-centric structures) to support bytewise I/O, serialization, and interop.
- Enumerate requirements, constraints, and open questions before implementation.

## Areas to Define (to be filled in later)
- **API surface:** Operations for allocate/read/write/resize/reset; error handling; interaction with existing buffer ops.
- **Memory model:** Backing store layout, alignment concerns, endianness, and bounds checks.
- **VM integration:** How byte buffers are referenced/tagged, how they coexist with list/digest/string segments, and lifetime management.
- **Interop:** Conversion to/from strings, lists, and external data (files/sockets) without extra copies.
- **Performance goals:** Throughput/latency targets, zero-copy opportunities, and acceptable overhead.
- **Testing strategy:** Unit + integration tests, fuzzing for bounds/overflow, compatibility with existing buffer tests.

## Open Questions
- Should byte buffers live in a dedicated segment or reuse existing heap structures with byte-level APIs?
- How to encode buffer references (new tag vs. reuse existing tags with metadata)?
- What safety guarantees are required (immutable views vs. mutable slices)?

---

_Next steps: flesh out requirements, propose API and memory layout, and plan migration/compatibility with current buffer ops._
