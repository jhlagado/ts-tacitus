import { resetVM, executeTacitCode } from '../../utils/vm-test-utils';

describe('Capsule dispatch via data-stack ref (STACK_REF)', () => {
  beforeEach(() => resetVM());

  test('simple counter capsule dispatches using fetch+ref', () => {
    const code = `
      : make-counter
        0 var count
        capsule case
          'inc of 1 +> count ;
          'get of count ;
        ;
      ;

      make-counter
      fetch
      ref 'inc swap dispatch
      ref 'inc swap dispatch
      ref 'get swap dispatch
    `;

    const result = executeTacitCode(code);
    const last = result[result.length - 1];
    expect(last).toBe(2);
  });
});
