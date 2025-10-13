import { resetVM, executeTacitCode } from '../../utils/vm-test-utils';

describe('Counter capsule (case/of)', () => {
  beforeEach(() => resetVM());

  test('inc and get update and read state via dispatch', () => {
    const code = `
      : make-counter
        0 var count
        does case
          "inc" of 1 +> count ;
          "get" of count ;
        ;
      ;
      
      make-counter dup
      "inc" swap dispatch
      "get" swap dispatch
    `;

    const stack = executeTacitCode(code);
    // Final value should be current count = 1
    const last = stack[stack.length - 1];
    expect(last).toBe(1);
  });
});
