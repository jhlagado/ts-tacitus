import { resetVM, executeTacitCode } from '../../utils/vm-test-utils';

describe('Nested capsules - outer dispatch triggers inner dispatch', () => {
  beforeEach(() => resetVM());

  test('outer inc forwards to inner inc; both counts advance', () => {
    const code = `
      : make-inner
        0 var innerCount
        capsule case
          'inc of 1 +> innerCount ;
          'get of innerCount ;
        ;
      ;

      : make-outer
        make-inner var child
        0 var outerCount
        capsule case
          'inc of 1 +> outerCount 'inc &child dispatch ;
          'get of outerCount ;
          'child-get of 'get &child dispatch ;
        ;
      ;

      make-outer
      dup 'inc swap dispatch
      dup 'inc swap dispatch
      dup 'child-get swap dispatch
      over 'get swap dispatch
    `;

    const result = executeTacitCode(code);
    const n = result.length;
    // Expect inner count first (from 'child-get), then outer count (from 'get)
    expect(result[n - 2]).toBe(2);
    expect(result[n - 1]).toBe(2);
  });
});
