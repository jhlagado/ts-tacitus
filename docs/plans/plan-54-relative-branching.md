# Plan 54 – Introduce Relative Branch Opcodes

## Goal
Add two new branching opcodes that use signed 16-bit relative offsets (forward/backward) while keeping the existing absolute-branch opcodes untouched. This enables bytecode relocation and future optimizations without disrupting the current codebase. Relative versions mirror the semantics of `Branch` (unconditional) and `IfFalseBranch` (conditional) but consume a signed offset rather than an absolute address.

## Constraints & Notes
- Relative offsets are measured in **bytes** from the *next* instruction pointer (standard PC-relative addressing).
- Offset is signed 16-bit (`-32768..32767`); values outside this range should raise a compile-time error.
- Existing opcodes remain for backward compatibility; the new ones will be prefixed with `R` (e.g., `RBranch`, `RIfFalseBranch`).
- Parser/compiler must continue emitting absolute branches until the new ones are tested and rolled out gradually.
- VM runtime must support both absolute and relative branch opcodes.

## Implementation Plan

### 1. Opcode & VM Support
1. Add `RBranch` and `RIfFalseBranch` enum values in `src/ops/opcodes.ts` (near existing branch opcodes).
2. Implement runtime handlers:
   - **Unconditional (`RBranch`)**: fetch signed 16-bit offset, add to `vm.IP`, continue execution.
   - **Conditional (`RIfFalseBranch`)**: pop top-of-stack; if zero (`false`), add offset; otherwise continue sequentially. Ensure stack underflow guards match existing branch logic.
3. Register the new opcodes in `src/ops/builtins.ts` (`OPCODE_TO_VERB`) and wire them to the new handlers (likely in `src/ops/control.ts` or a new shared file).

### 2. Compiler / Parser Emission
1. Extend compiler helpers in `src/lang/compiler.ts` to emit signed offsets (e.g., `compilerCompileRelativeJump(vm, vm.compiler, offset)`).
2. Update parser branching helpers (`beginIfImmediate`, `beginElseImmediate`, match/with structures) so they can optionally use relative offsets. Initially keep emitting absolute branches; the relative versions can be behind a feature flag or second code path.
3. Update `runImmediateCode` / meta stacks for tracking patch locations to include new relative patch entries.

### 3. Test Coverage
1. Add unit tests in `src/test/ops/core/branch-relative.test.ts` (or extend `branch-coverage` suite) to:
   - Verify `RBranch` jumps forward/backward.
   - Verify `RIfFalseBranch` executes jump only when the top of stack is zero.
   - Validate out-of-range offsets throw compilation errors.
2. Add integration tests in `src/test/lang` (e.g., `conditionals.test.ts`) to confirm parser can emit and run relative branches when enabled.

### 4. Rollout Strategy
1. Keep emitting absolute branches by default; add a compiler flag (env or feature toggle) to opt into relative emission for targeted tests.
2. Once relative opcodes are stable and tests cover them, gradually migrate compiler paths (IF/ELSE, loops, match-with) to emit relative offsets.
3. When migration completes, evaluate whether absolute branch opcodes can be deprecated (future plan).

### 5. QA & Tooling
1. `yarn test` + `yarn lint` after each implementation stage.
2. For bytecode inspection, extend existing debug utilities (e.g., `debug-square-bytecode.ts`) to print relative offsets for verification.

## Next Steps
- Confirm opcode names (`RBranch`, `RIfFalseBranch`) and signed-offset semantics.
- Implement Stage 1 (runtime support) and add unit tests for the new opcodes.
