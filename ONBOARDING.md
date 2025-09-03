Must-read specs (before coding)

  • docs/specs/lists.md: Reverse list layout, slots vs elements, span traversal, structural ops.
  • docs/specs/tagged.md: NaN-boxed tags, active tags, payload widths, runtime invariants.
  • docs/specs/refs.md: STACK_REF/RSTACK_REF/GLOBAL_REF semantics, resolve rules, segment model.
  • docs/specs/access.md: Path-based get/set semantics, address-returning traversal.
  • docs/specs/polymorphic-operations.md: How ops accept values or refs transparently.


  Project rules and onboarding

  • ONBOARDING.md: Quick start; how tests are written and run here.
  • CLAUDE.md: C/assembly-port constraints; C-like loops, no JS idioms; spec-first, zero
    regressions.


  Critical source files

  • Core
    • src/core/vm.ts: VM state, SP/RP/BP/IP; memory segments.
    • src/core/tagged.ts: Tag enum, to/from encoding, NIL.
    • src/core/list.ts: isList, getListLength, getListElementAddress, reverseSpan.
    • src/core/refs.ts: isRef, resolveReference, readReference, createSegmentRef.
    • src/core/constants.ts: SEG_STACK, SEG_RSTACK, sizes.
  • Ops
    • src/ops/list-ops.ts: List ops
      (length/size/slot/elem/fetch/store/find/head/tail/unpack/concat/reverse/ref/resolve).
    • src/ops/select-ops.ts: Path-based address traversal (select); stack-only iterative
      pipeline.
    • src/ops/builtins.ts + src/ops/opcodes.ts: Dispatch wiring and opcodes.
  • Strings
    • src/strings/digest.ts: String storage; required for key comparisons.
  • Tests infra
    • src/test/utils/vm-test-utils.ts: executeTacitCode, resetVM, helpers.


  Non-negotiable invariants (lists)

  • Header at TOS: [payload ...] [LIST:s] ← TOS.
  • Slots vs elements: slots are cells; elements may span multiple slots; traversal uses
    span(header).
  • Element addressing: slot O(1) by index; elem O(n) by span-walk; out-of-bounds → NIL.
  • Mutation: in-place only to simple slots; compound replacement must be type/slot-count
    compatible.


  References and polymorphism

  • Ref kinds: STACK_REF (SEG_STACK), RSTACK_REF (SEG_RSTACK), GLOBAL_REF (future).
  • Always return segment-correct refs (use createSegmentRef).
  • resolveReference for segment+address; fetch materializes compounds.
  • Ops must accept LIST or REF targets transparently (no heap; stack spans only).


  Testing protocol (NaN-boxing safe)

  • Behavioral only: use Tacit code via executeTacitCode; never inspect tag internals in tests.
  • Always run yarn test after steps; yarn lint before finishing.
  • Use resetVM() between tests; assert lengths/values/ordering; return NIL for misses/errors.


  Key ops status and expectations

  • length: slot count (O(1)); returns -1 for non-list.
  • size: element count via traversal (O(n)).
  • slot/elem: return segment-correct refs; O(1)/O(n) respectively; NIL on OOB.
  • fetch/store: ref-aware; store resolves source refs; compound compatibility enforced.
  • find: maplist key → value address; supports default fallback; segment-correct refs.
  • head/tail/reverse/concat: structural, preserve element units; new list on stack.
  • ref/resolve: convert list to STACK_REF; materialize any ref.


  selectOp approach (path-based address access)

  • Input: ( target path ); path is list of simple elements (numbers for elem, strings for find).
  • Pipeline (stack-only, SP-neutral per step):
    • createTargetRef: produce initial ref under path (reuse ref if already a ref).
    • For each path element: push element → call elem/find → nip previous ref; on NIL, drop path
      and return ( target NIL ).
    • traverseMultiPath: iterates elements by span (assumed simple), removes path at end → ( 
      target final-ref ).
  • Verified manually and through tests; chainable elem/find; final fetch yields scalar/compound.


  High-signal tests to review/run

  • src/test/ops/lists/list-spec-compliance.test.ts: Canonical spec behaviors.
  • src/test/ops/lists/concat-scenarios.test.ts: All concat cases incl. nested units.
  • src/test/ops/access/select-op.test.ts: Step-by-step
    createTargetRef/processPathStep/traverseMultiPath, ref targets (STACK/RSTACK), mixed
    numeric/string paths, default fallback.
  • src/test/core/unified-references.test.ts: Ref constructors/guards; fetch polymorphism.


  Practical guidelines

  • Favor helpers: getListHeaderAndBase, createSegmentRef, resolveReference.
  • Keep ops SP-neutral where intended (e.g., per-step in select); drop inputs in single SP
    adjustment for builders.
  • Think in element spans, not raw cells; no heap or intermediate variables—use stack spans and
    address math.
  • Maintain segment-correct refs end-to-end; test both STACK_REF and RSTACK_REF paths.
