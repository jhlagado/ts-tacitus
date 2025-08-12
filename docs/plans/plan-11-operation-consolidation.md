# Plan 11 — Operation File Consolidation & Deduplication

Status: 🎯 **ACTIVE** - Critical architectural cleanup  
Owner: core  
Scope: Eliminate massive operation file fragmentation and complete duplications
Timebox: 2-3 days (focused consolidation)  

---

## 0. Context & Audit Findings

**THE REAL PROBLEM**: Comprehensive audit revealed the codebase has:
- **14+ operation files** for what should be 4 logical groups
- **COMPLETE duplication** of math operations across 3 files
- **Fragmented imports** making maintenance impossible
- **Inconsistent naming** (`builtins-*` vs `*-ops`)
- **Print operations** split unnecessarily across 2 files

**THE SOLUTION**: **Systematic consolidation** following the well-organized test structure.

---

## 1. Critical Issues Identified by Audit

### 🚨 **COMPLETE MATH OPERATION TRIPLICATION**
**Evidence**: Every math operation exists in 3 files:
- `builtins-math.ts` (319 lines): addOp, subtractOp, multiplyOp, etc. (13 ops)
- `arithmetic-ops.ts` (258 lines): absOp, negOp, expOp, sqrtOp, etc. (10 ops)  
- `math-ops.ts` (332 lines): **DUPLICATES ALL 23 operations above**

**Import Confusion**: 
- `builtins-register.ts` imports from `math-ops.ts` (consolidated version)
- `builtins.ts` imports from originals (`builtins-math.ts` + `arithmetic-ops.ts`)

### 🚨 **OPERATION FILE EXPLOSION** 
**Current**: 14 scattered files in `src/ops/`
**Should be**: 4-6 logical files matching test structure

```
Current Mess:              Should Be:
├── builtins-math.ts      ├── math-ops.ts (ALL math)
├── arithmetic-ops.ts     ├── core-ops.ts (VM control) 
├── math-ops.ts (dupe!)   ├── stack-ops.ts (move from core/)
├── builtins-unary-op.ts  ├── list-ops.ts (lists)
├── builtins-print.ts     ├── print-ops.ts (output)
├── builtins-raw-print.ts ├── control-ops.ts (conditionals)
├── builtins-conditional.ts
├── builtins-interpreter.ts
├── builtins-list.ts
├── builtins-register.ts
├── builtins.ts
├── define-builtins.ts
├── opcodes.ts
└── combinators/
```

### 🚨 **PRINT OPERATION DUPLICATION**
- `builtins-print.ts` (157 lines): "human-readable"  
- `builtins-raw-print.ts` (50 lines): "raw values"
- **Both could be 1 file** (207 lines total)

---

## 2. Implementation Plan

### **Phase 1: Eliminate Math Triplication** (Day 1)
**Goal**: Remove 332 lines of pure math operation duplication

#### Step 1.1: Analyze Current Math Import Usage
**Action**: Determine which files are actually used vs duplicated
**Process**:
1. Check all imports of math operations  
2. Identify active vs unused implementations
3. Map current registration usage

#### Step 1.2: Consolidate to Single Math File  
**Action**: Create definitive `math-ops.ts` with all operations
**Process**:
1. Take best implementations from each file
2. Consolidate into clean `math-ops.ts`  
3. Include: arithmetic + advanced math + comparisons + unary ops
4. Update `builtins-register.ts` to use consolidated file

#### Step 1.3: Delete Duplicate Math Files
**Action**: Remove `builtins-math.ts` and `arithmetic-ops.ts` 
**Process**:
1. Update all imports to use `math-ops.ts`
2. Test after each import change
3. Delete original files when no longer imported
4. **Run tests after each deletion**

**Success Criteria - Phase 1**:
- [ ] Single `math-ops.ts` file with all math operations
- [ ] All imports updated to use consolidated file  
- [ ] `builtins-math.ts` and `arithmetic-ops.ts` deleted
- [ ] ~577 lines of duplicate code eliminated (319+258)
- [ ] All tests pass

---

### **Phase 2: Consolidate Print Operations** (Day 1)  
**Goal**: Merge print files and standardize naming

#### Step 2.1: Merge Print Files
**Action**: Combine `builtins-print.ts` + `builtins-raw-print.ts` → `print-ops.ts`
**Process**:
1. Create `print-ops.ts` with both operations
2. Update imports in `builtins-register.ts`
3. Delete original print files
4. Test after each change

#### Step 2.2: Rename Core Files for Consistency  
**Action**: Standardize to `*-ops.ts` naming pattern
**Process**:
1. `builtins-interpreter.ts` → `core-ops.ts` (VM operations)
2. `builtins-conditional.ts` → `control-ops.ts` (flow control)
3. `builtins-list.ts` → `list-ops.ts` (list operations)
4. Update all imports
5. Test after each rename

**Success Criteria - Phase 2**:
- [ ] Print operations in single `print-ops.ts` file (~200 lines)
- [ ] Consistent `*-ops.ts` naming for all operation files
- [ ] All imports updated and tested
- [ ] Original `builtins-*` files deleted
- [ ] All tests pass

---

### **Phase 3: Final File Structure** (Day 2)
**Goal**: Clean, logical operation file organization

#### Step 3.1: Move Stack Operations  
**Action**: Move `stack-ops.ts` from `core/` to `ops/`
**Process**:
1. Move `src/core/stack-ops.ts` → `src/ops/stack-ops.ts` 
2. Update all imports throughout codebase
3. Test imports

#### Step 3.2: Clean Up Registration
**Action**: Simplify `builtins-register.ts` imports
**Process**:
1. Update to import from consolidated files
2. Group imports by logical category
3. Remove complex import chains

**Target Final Structure**:
```
src/ops/
├── core-ops.ts       # VM control (eval, call, abort, etc.)
├── math-ops.ts       # ALL math operations (arithmetic + advanced)  
├── stack-ops.ts      # Stack manipulation (moved from core/)
├── list-ops.ts       # List operations
├── print-ops.ts      # Output operations (print + raw-print)
├── control-ops.ts    # Conditional logic
├── opcodes.ts        # Opcode definitions (keep)
├── builtins.ts       # Main dispatcher (keep)
├── builtins-register.ts # Registration (simplify imports)
└── combinators/      # Keep separate (specialized)
```

**Clean Import Pattern** (in `builtins-register.ts`):
```typescript
// Before: 8+ complex imports
import { addOp, absOp, negOp, ... } from './builtins-math';     
import { absOp, expOp, ... } from './arithmetic-ops';  // DUPLICATE!
import { mNegateOp } from './builtins-unary-op';
import { printOp } from './builtins-print';
import { rawPrintOp } from './builtins-raw-print';
// etc...

// After: 4-5 clean imports  
import { addOp, absOp, negOp, expOp, ... } from './math-ops';      // ALL math
import { evalOp, callOp, ... } from './core-ops';                  // VM ops
import { printOp, rawPrintOp } from './print-ops';                 // Output
import { lengthOp, elemOp, ... } from './list-ops';                // Lists
import { dupOp, dropOp, ... } from './stack-ops';                  // Stack
```

**Success Criteria - Phase 3**:
- [ ] 6 logical operation files (from 14+)
- [ ] Clean, simple imports in registration
- [ ] All operations easy to locate
- [ ] Stack operations moved to ops/ directory
- [ ] All tests pass

---

## 3. Testing Protocol ⚠️ **MANDATORY**

### **Testing Rules**:
1. **Run `yarn test` after EVERY file change**
2. **If ANY test fails, STOP and fix immediately**  
3. **Never proceed with failing tests**
4. **Git commit after each successful consolidation**

### **Recovery Strategy**:
- **Incremental changes**: One file consolidation at a time
- **Import updates**: One import statement at a time
- **Immediate revert**: If tests fail, revert and analyze
- **No accumulation**: Fix each issue before proceeding

---

## 4. Expected Results

### **Measurable Improvements**:
- [ ] **~900+ lines eliminated** (577 math duplicates + print + naming cleanup)
- [ ] **14 files → 6 files** in ops/ directory  
- [ ] **Single source of truth** for every operation
- [ ] **4-5 clean imports** instead of 8+ complex imports
- [ ] **Zero duplicate implementations**

### **Developer Experience**:
- [ ] **Easy navigation**: Obvious where every operation lives
- [ ] **Logical grouping**: Files match test structure  
- [ ] **Simple maintenance**: Change operation in one obvious place
- [ ] **Clear imports**: Import from logical file groups
- [ ] **Consistent naming**: All files follow `*-ops.ts` pattern

### **Architectural Benefits**:
- [ ] **Matches test structure**: Source mirrors well-organized tests
- [ ] **Clear responsibilities**: Each file has obvious purpose
- [ ] **Simplified dependencies**: Clean import hierarchy
- [ ] **Future-proof**: Easy to add new operations in right place

---

## 5. Timeline & Risk Assessment

| Phase | Duration | Focus | Risk Level |
|-------|----------|-------|------------|
| **Phase 1** | 0.5 day | Math consolidation | LOW (clear duplicates) |
| **Phase 2** | 0.5 day | Print + naming | LOW (simple merges) |  
| **Phase 3** | 1 day | Final structure | MEDIUM (import updates) |

**Total**: 2 days focused work
**Success Rate**: HIGH (incremental with testing)
**Rollback**: Easy (git commits after each step)

---

This plan addresses the **real architectural problems** identified in the audit: massive duplication, fragmented files, and complex import hierarchies. The result will be a clean, maintainable operation structure that matches the project's well-organized test suite.
