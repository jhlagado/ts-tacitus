# GitHub Copilot Development Protocol

## 🚨 CRITICAL MULTI-STEP IMPLEMENTATION PROTOCOL 🚨

### **MANDATORY: Stop After Every Step**

When executing any multi-step plan or implementation, GitHub Copilot MUST:

1. **STOP AFTER EVERY STEP** - Never continue to the next step automatically
2. **GET USER APPROVAL** - Explicitly request permission before proceeding  
3. **DOCUMENT PROGRESS** - Update implementation plan with completion status
4. **VALIDATE EACH STEP** - Run tests and verify functionality before requesting approval
5. **NO ASSUMPTIONS** - Never assume the user wants to continue to the next step

### **Required Protocol Format:**
```
✅ COMPLETED: Step N - [Description]
⏸️ STOPPING HERE - Awaiting user approval to proceed to Step N+1
NEXT STEP: Step N+1 - [Description]
```

### **This Protocol Applies To:**
- Implementation plans with multiple phases
- Feature development with sequential steps  
- Refactoring that touches multiple files
- Any work spanning more than one logical unit
- Multi-file changes or complex modifications

### **Violation Consequences:**
**Violation of this protocol is unacceptable and breaks user workflow.**

### **Examples of Required Stops:**
- After completing one phase of a multi-phase plan
- After implementing one feature in a feature set
- After modifying one component in a multi-component change
- After each significant code change that could be independently tested
- After each logical milestone in development work

### **User Approval Required:**
GitHub Copilot must wait for explicit user approval such as:
- "Continue to the next step"
- "Proceed with Step N+1" 
- "Yes, continue"
- Any other clear indication to proceed

**DO NOT proceed without explicit user permission.**
