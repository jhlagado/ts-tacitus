import { resetVM, executeTacitCode } from '../../utils/vm-test-utils';

describe('Capsule dispatch via global ref (GLOBAL_REF)', () => {
  beforeEach(() => resetVM());

  test.skip('counter capsule dispatches using &global alias', () => {
    const code = `
      : make-counter
        0 var count
        capsule case
          'inc of 1 +> count ;
          'get of count ;
        ;
      ;

      make-counter global gc
      &gc fetch ref 'inc swap dispatch
      &gc fetch ref 'inc swap dispatch
      &gc fetch ref 'get swap dispatch
    `;

    const result = executeTacitCode(code);
    const last = result[result.length - 1];
    expect(last).toBe(2);
  });
});
