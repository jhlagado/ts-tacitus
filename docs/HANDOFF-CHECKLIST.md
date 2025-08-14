# 🔄 Session Handoff Checklist

> **Use this checklist when ending a Claude session to ensure smooth transitions**

## 📋 Pre-Handoff Checklist

### Code Status
- [ ] **All changes committed to memory** - no unsaved work
- [ ] **Tests passing** - `yarn test` shows green
- [ ] **Build successful** - `yarn build` completes without errors
- [ ] **No breaking changes** - existing functionality intact

### Documentation Updates
- [ ] **Update ONBOARDING.md** - Current status, next tasks, blockers
- [ ] **Update active plan** - Mark completed steps, update progress
- [ ] **TodoWrite current** - All todos reflect actual status
- [ ] **Note any discoveries** - New insights, architecture decisions, gotchas

## 📝 Handoff Information Template

### Session Summary
```markdown
**Date:** [YYYY-MM-DD]
**Duration:** [Hours/Minutes]  
**Focus:** [Main area of work]
**Plan:** [Active plan name and step]

**Completed This Session:**
- [List completed tasks]

**In Progress:**  
- [Current task and status]

**Next Session Should:**
- [Immediate next steps]
- [Specific files to examine]
- [Known issues to address]

**Architecture Decisions Made:**
- [Any significant technical decisions]

**Gotchas/Discoveries:**
- [Tricky issues encountered]
- [Useful debugging techniques] 
- [Performance insights]
```

### Technical Handoff Details
```markdown
**Modified Files:**
- `path/to/file.ts` - [What changed]
- `path/to/test.ts` - [Test updates]

**Test Status:**
- Total tests: [Number] 
- Passing: [Number]
- New tests: [Number]
- Skipped tests: [Number and reason]

**Build/Environment:**
- Node version: [If relevant]
- Dependencies: [If changed]
- Environment issues: [Any setup problems]

**Debug Information:**
- Key debugging commands used
- Useful console output patterns
- Performance observations
```

## 🎯 Specific Handoff Scenarios

### When Blocked
```markdown
**BLOCKED STATUS**
**Issue:** [Specific technical problem]
**Attempted Solutions:**
1. [What was tried]
2. [Results/why it failed]

**Recommended Next Steps:**
1. [Specific debugging approach]
2. [Alternative implementation ideas]
3. [Who/what to consult]

**Key Files:** [Files containing the problem]
**Error Messages:** [Exact error text]
```

### When Debugging
```markdown
**DEBUGGING SESSION**
**Problem:** [What's not working]
**Hypothesis:** [Current theory about cause]
**Evidence:** [Supporting observations]

**Debug Trail:**
1. [Step 1 and findings]
2. [Step 2 and findings]

**Next Debug Steps:**
- [Specific things to try]
- [Tests to run]
- [Code to examine]
```

### When Implementing New Feature
```markdown
**FEATURE DEVELOPMENT**
**Feature:** [What's being built]
**Progress:** [X% complete, specific parts done]
**Architecture:** [Key design decisions]

**Implementation Notes:**
- [Patterns followed]
- [Libraries/utilities used]  
- [Performance considerations]

**Testing Approach:**
- [Test strategy used]
- [Edge cases to cover]
- [Integration points]
```

## 🚨 Red Flags - Don't Hand Off If:

- [ ] Tests are failing (unless explicitly documenting why)
- [ ] Build is broken
- [ ] You made breaking changes without documenting them
- [ ] You started refactoring without finishing
- [ ] You have unstaged changes in git (unless intentional)

## ✅ Good Handoff Indicators:

- [ ] Clear next steps defined
- [ ] Blockers documented with context
- [ ] Progress measurable and verifiable  
- [ ] Architecture decisions recorded
- [ ] Test status is clear
- [ ] ONBOARDING.md reflects current reality

## 📞 Emergency Handoff

If you must hand off quickly:
1. **Update ONBOARDING.md handoff status** (minimum requirement)
2. **Run `yarn test`** and note result
3. **List modified files** and what changed
4. **State the immediate next task** clearly

---

**Remember:** A good handoff saves the next session 15-30 minutes of context rebuilding. A poor handoff wastes time and may lose progress.