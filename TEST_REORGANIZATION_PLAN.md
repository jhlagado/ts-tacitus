# Test Suite Reorganization Plan

## Current State Analysis

### Directory Structure

```
src/test/
├── cli/ (1 file)
├── core/ (27 files) - Infrastructure tests
├── integration/ (3 files)
├── lang/ (39 files) - Language implementation
├── ops/ (67 files) - Operation tests
│   ├── access/
│   ├── arithmetic/ (1 file after consolidation)
│   ├── broadcast/
│   ├── capsules/
│   ├── comparison/ (1 file after consolidation)
│   ├── conditional/
│   ├── control/
│   ├── core/
│   ├── dict/
│   ├── error-handling/
│   ├── heap/
│   ├── interpreter/
│   ├── lists/ (subdirs: build, integration, query, structure)
│   ├── local-vars/
│   ├── print/
│   ├── stack/ (10 files - needs consolidation)
│   └── strings/
├── repl/ (1 file)
├── stack/ (2 files) - Utility tests?
├── strings/ (2 files) - Utility tests?
└── utils/ (0 files)
```

### Issues Identified

1. **Core Tests (27 files)** - Too many granular files:
   - Multiple VM test files: `vm.test.ts`, `vm-*.test.ts` (8+ files)
   - Multiple tagged test files: `tagged.test.ts`, `tagged-*.test.ts` (3+ files)
   - Multiple list test files: `list.test.ts`, `list-*.test.ts` (2+ files)
   - Multiple refs test files: `unified-data-ref.test.ts`, `refs.*.test.ts` (2+ files)

2. **Lang Tests (39 files)** - Some redundancy:
   - Multiple parser test files
   - Multiple compiler test files
   - Multiple case/conditional test files
   - Capsules have their own subdirectory (good)

3. **Ops Tests (67 files)** - Needs consolidation:
   - Stack operations: 10 separate files (dup, drop, swap, etc.) - should be 1-2 files
   - Some operations have multiple test files

4. **Scattered Utilities**:
   - `stack/` directory (2 files) - should be in `ops/stack/` or `core/`
   - `strings/` directory (2 files) - should be in `ops/strings/`

## Proposed Reorganization

### Target Structure

```
src/test/
├── core/                    # Core infrastructure (consolidate to ~15 files)
│   ├── vm.test.ts           # All VM tests consolidated
│   ├── memory.test.ts       # Memory operations
│   ├── tagged.test.ts       # All tagged value tests
│   ├── list.test.ts         # List core operations
│   ├── refs.test.ts         # All reference tests
│   ├── dictionary.test.ts   # Dictionary operations
│   ├── format-utils.test.ts # Formatting (already consolidated)
│   ├── units.test.ts        # Unit helpers
│   └── utils.test.ts        # Core utilities
│
├── lang/                     # Language implementation (~25 files)
│   ├── parser.test.ts        # Parser (consolidate parser-*.test.ts)
│   ├── compiler.test.ts     # Compiler (already consolidated)
│   ├── interpreter.test.ts  # Interpreter (already consolidated)
│   ├── tokenizer.test.ts    # Tokenizer
│   ├── definitions.test.ts  # Colon definitions
│   ├── literals.test.ts     # Literal compilation
│   ├── conditionals.test.ts # if/else/when/do (consolidate)
│   ├── case.test.ts         # case/of (consolidate case-*.test.ts)
│   ├── variables.test.ts     # Variable parsing
│   ├── file-processor.test.ts
│   ├── executor.test.ts
│   ├── repl.test.ts
│   └── capsules/             # Keep capsules subdirectory
│       └── (existing capsule tests)
│
├── ops/                      # Operation tests (~40 files)
│   ├── arithmetic.test.ts    # Already consolidated
│   ├── comparison.test.ts   # Already consolidated
│   ├── stack.test.ts         # Consolidate all 10 stack files
│   ├── lists/                # Keep lists subdirectory structure
│   ├── strings/              # String operations
│   ├── access/               # Access operations
│   ├── control/              # Control flow
│   ├── conditional/          # Conditional operations
│   ├── print/                # Print operations
│   ├── local-vars/           # Local variables
│   └── (other op categories)
│
├── integration/              # End-to-end tests (3 files)
└── utils/                   # Test utilities (no test files)
```

## Consolidation Plan

### Phase 1: Core Tests Consolidation

**Target: 27 files → ~15 files**

1. **VM Tests** (8 files → 1 file):
   - Merge: `vm.test.ts`, `vm-*.test.ts` → `vm.test.ts`
   - Files to merge:
     - `vm.test.ts` (base)
     - `vm-abs-registers.test.ts`
     - `vm-comprehensive-testing.test.ts`
     - `vm-constructor.test.ts`
     - `vm-ip-operations.test.ts`
     - `vm-pointer-validation.test.ts`
     - `vm-push-symbol-ref.test.ts`
     - `vm-stack-operations.test.ts`
     - `vm-symbol-resolution.test.ts`
     - `vm-unified-dispatch.test.ts`

2. **Tagged Tests** (3 files → 1 file):
   - Merge: `tagged.test.ts`, `tagged-*.test.ts` → `tagged.test.ts`
   - Files to merge:
     - `tagged.test.ts` (base)
     - `tagged-local.test.ts`
     - `tagged-meta.test.ts`
     - `tagged-value-roundtrip.test.ts` (already reduced)

3. **Refs Tests** (3 files → 1 file):
   - Merge: `unified-data-ref.test.ts`, `refs.*.test.ts` → `refs.test.ts`
   - Files to merge:
     - `unified-data-ref.test.ts`
     - `refs.absolute-helpers.test.ts`
     - `reference-formatting.test.ts`

4. **List Tests** (2 files → 1 file):
   - Merge: `list.test.ts`, `list-memory.test.ts` → `list.test.ts`

### Phase 2: Lang Tests Consolidation

**Target: 39 files → ~25 files**

1. **Parser Tests** (3 files → 1 file):
   - Merge: `parser.test.ts`, `parser-*.test.ts` → `parser.test.ts`

2. **Case Tests** (3 files → 1 file):
   - Merge: `case-*.test.ts` → `case.test.ts`
   - Files: `case-control-flow.test.ts`, `case-corruption-branch.test.ts`, `case-immediate.test.ts`

3. **Conditional Tests** (2 files → 1 file):
   - Merge: `conditionals-immediate.test.ts`, `when-do-control-flow.test.ts` → `conditionals.test.ts`

### Phase 3: Ops Tests Consolidation

**Target: 67 files → ~40 files**

1. **Stack Operations** (10 files → 1-2 files):
   - Merge all `stack/*.test.ts` → `stack.test.ts`
   - Files: `dup.test.ts`, `drop.test.ts`, `swap.test.ts`, `over.test.ts`, `rot.test.ts`, `revrot.test.ts`, `pick.test.ts`, `tuck.test.ts`, `nip.test.ts`, `stack-utils.test.ts`

2. **Move scattered tests**:
   - `test/stack/*.test.ts` → `test/ops/stack/`
   - `test/strings/*.test.ts` → `test/ops/strings/`

## Implementation Steps

1. **Create backup** (git commit current state)
2. **Phase 1: Core consolidation** (highest impact)
3. **Phase 2: Lang consolidation**
4. **Phase 3: Ops consolidation**
5. **Move scattered files**
6. **Update imports**
7. **Run full test suite**
8. **Verify coverage maintained**

## Expected Results

- **File count**: ~140 files → ~85 files (40% reduction)
- **Better organization**: Clear logical grouping
- **Easier navigation**: Related tests together
- **Maintained coverage**: No loss of test coverage
- **Faster tests**: Slightly faster due to less file overhead
