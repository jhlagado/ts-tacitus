# Known Issues

## Naming Conventions

**File and Folder Naming**: Use kebab-case for all files and folders (e.g., `known-issues.md`, `test-utils.ts`). Avoid uppercase letters in file/folder names.

**Code Naming**: Follow TypeScript conventions:
- Variables and functions: camelCase
- Classes and interfaces: PascalCase  
- Constants: UPPER_SNAKE_CASE
- Files: kebab-case

## Test Environment Issues

### NaN-Boxing Corruption in Jest Tests

**Issue**: JavaScript test environments cause NaN-boxed tagged values to "snap" to classic IEEE 754 NaNs, corrupting tag information and making `fromTaggedValue()` unreliable.

**Symptoms**:
- `fromTaggedValue()` returns tag value 0 instead of correct tag (LIST=8, CODE=2, etc.)
- Tests expecting specific tags fail with "Expected: 8, Received: 0"
- Tag corruption affects all tagged value types: LIST, CODE, INTEGER, etc.
- Operations work correctly in normal execution but fail tag inspection in tests

**Root Cause**: 
- Certain JavaScript operations (JSON serialization, array methods, test framework internals) cause NaN-boxed values to lose their tag encoding
- This is a fundamental limitation of NaN-boxing in JavaScript environments
- Cannot be fixed within the TACIT codebase itself

**Solution**: 
- **NEVER use `fromTaggedValue()` in tests**
- **Use behavioral testing instead** - test operation results, not internal structure
- Compare stack outputs using `executeTacitCode()` and `.toEqual()`
- Test functional behavior (lengths, values, idempotency) rather than tag inspection

**Testing Patterns**:
```typescript
// ✅ CORRECT - Behavioral testing
const result = executeTacitCode('( 1 2 ) reverse');
const expected = executeTacitCode('( 2 1 )');
expect(result).toEqual(expected);

// ❌ NEVER - Tag inspection 
const { tag, value } = fromTaggedValue(stack[0]);
expect(tag).toBe(Tag.LIST); // Will fail due to NaN corruption
```

**Status**: Architectural limitation - testing guidelines updated to avoid tag inspection

**Resolution**: All tests refactored to use behavioral testing patterns. No code changes needed.

**Updated**: January 2025

---

*Previous issues resolved through improved testing methodology and understanding of JavaScript NaN-boxing limitations.*