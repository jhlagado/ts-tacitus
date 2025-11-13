# Plan 50 — Tacit Native Testing System

Status: draft  
Priority: MEDIUM  
Complexity: HIGH  

## Goals

- Implement a unit testing framework written entirely in Tacit
- Enable developers to write and run tests using Tacit syntax
- Provide assertion primitives and test organization utilities
- Support test discovery, execution, and reporting within the Tacit runtime

## Out of Scope

- Integration with external test runners (Jest, etc.) - this is a pure Tacit solution
- Code coverage analysis (can be added later)
- Performance benchmarking (separate concern)

## Background

Currently, all testing is done via Jest/TypeScript test files. While this works well for testing the VM implementation itself, there's no way to write tests in Tacit for Tacit code. A native testing system would:

- Allow testing Tacit code in its natural environment
- Enable testing without TypeScript/Node.js context
- Provide a more idiomatic testing experience for Tacit developers
- Support testing user-defined functions and libraries

## Design Summary

### Core Components

1. **Assertion Primitives**: `expect`, `assert`, `assert-eq`, `assert-ne`, etc.
2. **Test Organization**: `test`, `describe`, `before-each`, `after-each` blocks
3. **Test Runner**: Execute test suites and collect results
4. **Reporting**: Format and display test results

### Example Usage (Proposed Syntax)

```tacit
: test-add
  2 3 add
  expect 5 eq
;

: test-multiply
  3 4 multiply
  expect 12 eq
;

: run-tests
  test-add
  test-multiply
  report
;
```

## Phases

### Phase 0 — Design & Specification (Current)

- [ ] Define test syntax and API
- [ ] Design assertion primitives
- [ ] Plan test organization structure
- [ ] Document expected behavior

### Phase 1 — Core Assertions

- [ ] Implement basic assertion operations (`assert`, `assert-eq`, `assert-ne`)
- [ ] Add stack-based assertion helpers
- [ ] Error reporting for failed assertions
- [ ] Basic test execution framework

### Phase 2 — Test Organization

- [ ] Implement `test` word for individual tests
- [ ] Add `describe` for test grouping
- [ ] Support `before-each` and `after-each` hooks
- [ ] Test discovery and collection

### Phase 3 — Test Runner

- [ ] Implement test execution engine
- [ ] Collect test results (pass/fail counts)
- [ ] Handle test failures gracefully
- [ ] Support test filtering/selection

### Phase 4 — Reporting

- [ ] Format test results output
- [ ] Display pass/fail summary
- [ ] Show failure details and stack traces
- [ ] Optional verbose mode

## Success Criteria

- Can write and run tests entirely in Tacit
- Assertion primitives work correctly
- Test organization (describe/test blocks) functions
- Test runner executes all tests and reports results
- Failed tests provide useful error messages
- All existing Tacit functionality remains unchanged

## Open Questions

- Should tests be compiled or interpreted?
- How to handle test isolation (stack/reset between tests)?
- Should we support async/await patterns for testing?
- Integration with existing Jest tests (or keep separate)?
- How to handle test fixtures and setup/teardown?

## Dependencies

- Core VM functionality (complete)
- Error handling system (complete)
- Stack operations (complete)
- String formatting for reports (may need enhancement)

## References

- Existing test infrastructure: `src/test/`
- VM execution model: `docs/specs/vm-architecture.md`
- Error handling: `docs/specs/errors-and-failures.md`


