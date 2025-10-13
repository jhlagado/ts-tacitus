import { vm } from '../../../core/global-state';
import { resetVM, executeTacitCode } from '../../utils/vm-test-utils';

describe('Capsule dispatch (degenerate body)', () => {
  beforeEach(() => resetVM());

  test('dispatch ignores message and returns constant', () => {
    const code = `
      : mk
        methods
        123
      ;
      mk
      ` +
      // args… method receiver dispatch ; no args, swap to put receiver last
      ' "any" swap dispatch ';

    const stack = executeTacitCode(code);
    // Expect the constant on stack
    expect(stack[stack.length - 1]).toBe(123);
  });
});
