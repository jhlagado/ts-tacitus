# 🚀 CLAUDE ONBOARDING: TACIT VM Development

> **For Fresh Claude Instances**: This gets you up to speed in 5 minutes

## 🔴 CRITICAL: Read These First (2 minutes)
- [ ] `CLAUDE.md` - Project rules & architecture (MUST READ FIRST)
- [ ] `docs/plans/plan-14-get-set-combinators.md` - Current active plan
- [ ] Last session status from `#handoff-status` below

## ⚡ Quick Status Check (1 minute) 
```bash
# Verify environment works
yarn test  # Should pass 924+ tests
```

## 🎯 Current Focus: Plan 14 Get/Set Combinators - Step 3.8
**Problem:** Block execution in get combinator produces 0 elements instead of 1  
**Goal:** Complete get/set combinators for path-based nested structure access  
**Blocker:** `get { "key" }` blocks not executing properly in evalImpl() call

## 📍 Handoff Status
<!-- UPDATE THIS SECTION WHEN ENDING SESSIONS -->
### Session Date: 2024-12-19
**Completed:** Steps 1.1-3.7 (get combinator foundation working)
**In Progress:** Step 3.8 (block execution debugging) 
**Next Task:** Fix `{ "key" }` block execution in getOp - produces 0 elements instead of 1
**Files Modified:** `src/ops/access-ops.ts`, `src/test/ops/access/get-combinator.test.ts`
**Tests Status:** 924 core tests pass, 3 get combinator tests pass, 2 skipped (TODO: fix block execution)

### Key Insights from Last Session:
- ✅ Combinator approach works (abandoned makeListOp approach)
- ✅ Parser support implemented correctly (`target get { path }` syntax)
- ✅ Basic maplist lookup works: `( "name" "Alice" ) get { "name" }` returns "Alice"
- ❌ Issue is in evalImpl() call within getOp - single-element blocks don't execute
- 🔍 Compare with `src/ops/combinators/do.ts` doOp implementation for reference
- 💡 Polymorphic access operations (slot, elem, fetch) already implemented and working

## 🏗️ **Architecture Overview (2 minutes)**

### **Tagged Values System**
- **NaN-boxed 32-bit values** with 6-bit tags + 16-bit payload
- **Key types:** NUMBER(0), SENTINEL(1), CODE(2), STACK_REF(3), STRING(4), LIST(5), BUILTIN(7)
- **STACK_REF:** Cell-based addressing for polymorphic operations

### **Stack-based VM Architecture** 
- **64KB segmented memory:** STACK(16KB) + RSTACK(4KB) + CODE(8KB) + STRING(36KB)
- **LIST format:** `[payload-n] ... [payload-0] [LIST:n] ← TOS` (header at top-of-stack)
- **Postfix operations:** All operations work on stack, no infix except combinators

### **Combinator System**
- **Parser-supported:** `do { }`, `repeat { }`, `get { }`, `set { }` 
- **Compilation:** `{ block }` compiles to bytecode address, then operation called
- **Execution:** Operations receive block address, use `evalImpl(vm)` to execute

## 🎯 **Current Implementation Status**

### **✅ Working Components:**
```javascript
// Parser combinator support
'target get { path }'              // ✅ Syntax parses correctly

// Basic maplist lookup  
'( "name" "Alice" ) get { "name" }' // ✅ Returns "Alice"
'42 get { }'                       // ✅ Returns 42 (empty path)

// Polymorphic operations (slot/elem/find/fetch)
// ✅ Work with both LIST and STACK_REF inputs
```

### **🔨 TODO Components:**
```javascript
// Block execution issue
'( "name" "Alice" ) get { "missing" }' // ❌ Should return NIL, but breaks

// Multi-element paths (not implemented yet)  
'maplist get { "users" 0 "name" }'    // ❌ Multi-step traversal

// Set combinator (stub only)
'target set { path } newValue'        // ❌ Not implemented
```

## 📋 **Key Files to Know**

### **Core Implementation:**
- `src/ops/access-ops.ts:22-92` - getOp combinator (main implementation)
- `src/lang/parser.ts:296-317` - Parser support for get/set combinators
- `src/ops/list-ops.ts:340-432` - Polymorphic access operations (slot/elem/find/fetch)

### **Testing:**
- `src/test/ops/access/get-combinator.test.ts` - Current get combinator tests
- `src/test/utils/vm-test-utils.ts` - Use `resetVM()` in test setup

### **Reference Implementation:**
- `src/ops/combinators/do.ts` - Working combinator for comparison
- `src/core/tagged.ts:140-160` - STACK_REF implementation

## 🚀 **Development Workflow**

### **Always Follow This Pattern:**
```bash
# 1. Make changes
# 2. Build and test immediately
yarn build && yarn test

# 3. Test specific functionality
yarn test src/test/ops/access/get-combinator.test.ts

# 4. Use TodoWrite tool to track progress  
# 5. Never commit - user handles git
```

### **Critical Rules from CLAUDE.md:**
- **ALWAYS run `yarn test` after every change** - 924 tests must pass
- **Use `resetVM()` in test setup** - prevents test isolation issues
- **Never modify `docs/specs/`** - specifications are read-only
- **C-like code style** - avoid .map/.filter, write for future C port
- **No comments unless requested** - follow existing patterns

## 🔍 **Debugging the Current Issue**

### **Problem Analysis:**
```javascript
// In getOp (src/ops/access-ops.ts:39-46):
evalImpl(vm);
const elementCount = (afterSP - beforeSP) / 4;
// elementCount should be 1 for { "key" }, but it's 0
```

### **Debug Steps:**
1. **Compare with doOp** - `src/ops/combinators/do.ts:18-22` does same pattern
2. **Add debug output** - log block address, SP before/after eval
3. **Check block compilation** - ensure `{ "key" }` creates valid block address
4. **Verify eval implementation** - ensure evalImpl actually executes blocks

### **Expected Behavior:**
```javascript
// Should work like do combinator:
'5 do { 1 add }'    // ✅ Works: block executes, pushes 1, adds to 5
'target get { key }' // ❌ Broken: block should execute, push key, but doesn't
```

## 📈 **Success Metrics**
- [ ] All existing 924+ tests continue to pass
- [ ] `get { "key" }` produces 1 element (not 0)
- [ ] Single-key maplist lookup works with missing keys (returns NIL)  
- [ ] Multi-element path traversal implemented
- [ ] Set combinator basic functionality
- [ ] Coverage stays above 80%

## 🎯 **Next Session Goals**
1. **Immediate:** Fix block execution in getOp
2. **Short-term:** Complete single-key get/set functionality  
3. **Medium-term:** Multi-element path traversal
4. **Long-term:** Advanced features (nested updates, error handling)

---
**🚨 Update the handoff status above when ending sessions!**