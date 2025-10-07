# `SPBytes` Usage Audit (Phase 5)

_Date:_ 2025-02-14

## Summary
`SPBytes` now appears only in deliberate byte-oriented helpers. Production code and high-level tests operate on stack cells (`vm.SP`). Remaining usages are summarised below.

| Location | Context | Current Role | Action |
| --- | --- | --- | --- |
| `debug-base-addr.js:13-25` | Developer debug script | Prints and compares raw byte offsets. | Keep; script works at byte granularity. |
| `src/core/vm.ts` accessors | Canonical API | `SPBytes` getter/setter for byte precision. | Retain for explicit byte math. |
| `src/test/stack/find.test.ts` | Low-level memory fixture | Writes raw bytes then adjusts `SPBytes`. | Keep; fixture intentionally exercises byte offsets. |
| `src/test/ops/stack/stack-utils.test.ts` | Stack helper in tests | Pokes memory via bytes to craft tagged values. | Keep. |

## Next Steps
- No additional work required for Phase 5; any future byte-level diagnostics should continue to use `SPBytes` explicitly.
