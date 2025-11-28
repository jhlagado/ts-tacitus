# Code Address Space Expansion (Configurable Alignment)

**Status:** Draft  
**Date:** 2025-01-XX  
**Related:** `OPCODE_MIGRATION_PLAN.md`, `vm-architecture.md`

## Current State (after tag/value expansion)

- `Tag` encoding: 3 bits (0–7). Tag 0 = NUMBER/raw float / canonical NaN; SENTINEL/STRING/CODE/REF/LIST/RESERVED/LOCAL occupy the remaining codes.
- Value payload: 19 bits (unsigned except SENTINEL).
- CODE payload carrier: X1516 (15-bit). Currently treated as byte-aligned → ~32K byte code space.
- Branch opcodes: already relative. Call is still absolute (X1516 payload → byte address).
- IP: 16-bit byte address (0–65535) today.

## Goal

Expand the reachable code space while keeping opcodes 2-byte wide and making code alignment a configurable knob. Target: 18-bit code space (256 KB) via 8-byte alignment on CODE payloads; allow experimentation with other alignments.

## Bit Allocation (implemented)

```
Sign (1) | Exponent (8) | NaN bit (1) | Tag (3) | Value (19)
```

- Tag: compact 3-bit set (see above).
- Value: 19 bits; CODE/STRING/REF/LIST use unsigned; SENTINEL is signed.

## CODE Payload Scaling

Treat the 15-bit X1516 payload as a *scaled index*:

- Byte address = payload << ALIGN_SHIFT
- ALIGN_SHIFT is derived from alignment (1/2/8/16 bytes → shifts 0/1/3/4).

Alignment options (configurable constant — see `CODE_ALIGN_BYTES`/`CODE_ALIGN_SHIFT`):

| Alignment | Payload reach | Byte reach | Notes                  |
|-----------|---------------|------------|------------------------|
| 1 byte    | 15 bits       | 32 KB      | Current default        |
| 2 bytes   | 16 bits       | 64 KB      | Minimal change         |
| 8 bytes   | 18 bits       | 256 KB     | **Preferred (ESP32)**  |
| 16 bytes  | 19 bits       | 512 KB     | Max reach, more waste  |

## IP / Segment

- Grow IP to 18 bits (0–262143) in the preferred configuration; 19-bit is possible if alignment shifts allow and segment size warrants.
- Update code segment bounds and loaders to honor the configured size.

## Call / Branch Encoding

- Branch remains relative (16-bit signed offset).
- Call is repurposed to a 16-bit signed relative offset (±32768 bytes ≈ ±32 KB). Use when the target is in range.
- Keep absolute calls via scaled X1516 payloads for far targets (using the configured alignment).
- Compiler chooses relative vs absolute based on distance and alignment.

## Data vs Code

- Data arena already benefits from 19-bit payload × 4-byte cells ≈ 512K cells (~2 MB). No change needed there.
- Code expansion is the primary focus; asymmetry is acceptable.

## Implementation Plan (stepped)

1) **Config knob**
   - Introduce constants for CODE alignment/scale (default 1 byte; allow 2/8/16). Centralize in `constants.ts` or similar.
   - Make X1516 decode/encode use the alignment shift when forming byte addresses.

2) **CODE helpers**
   - Update CODE handling in `Tagged`/`getTaggedInfo`/eval to apply alignment shift when computing byte addresses; keep sign-bit (IMMEDIATE) semantics unchanged.
   - Ensure printers/disassemblers show both payload and resolved byte address given the current alignment.

3) **Relative Call**
   - Implement Call-relative (16-bit signed offset). Emit from compiler when reachable; fall back to absolute scaled form otherwise.
   - Keep Branch untouched (already relative).

4) **Compiler/assembler**
   - Distance-based choice between relative and absolute; warn/error on out-of-range relative calls.
   - Update any bytecode loaders/emitters to tag absolute calls as scaled X1516 payloads.

5) **IP/segment sizing**
   - Bump code-segment constants to the 18-bit target (256 KB) when alignment is 8 bytes; allow overriding for experiments.
   - Enforce bounds checks in VM fetch/dispatch paths using the configured size.

6) **Tests**
   - Round-trip 19-bit payloads at high values for CODE/STRING/REF.
   - Execution tests: near call (relative), far call (absolute scaled), boundary violations, misaligned payload errors.
   - X1516 decode/encode under different alignment settings.

7) **Docs & migration**
   - Document alignment config, scaling math, and dual Call forms.
   - Note breaking change if default alignment shifts from 1 byte; consider bytecode versioning or a flag.

## Open Questions / Risks

- Precision: ensure float32 round-trips preserve the high payload bits under all alignments.
- Tooling: disassembler/pretty printers must be alignment-aware.
- Compatibility: all existing tests must continue to pass when the alignment knob is exercised.
