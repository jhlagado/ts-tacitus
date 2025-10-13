import { resetVM, executeTacitCode } from '../../utils/vm-test-utils';

describe('Capsule stored in function local (frame extension)', () => {
  beforeEach(() => resetVM());

  test('function creates counter capsule, stores in local, dispatches methods', () => {
    const code = `
      : make-counter
        0 var count
        methods
        case
          "inc" of 1 +> count ;
          "get" of count ;
        ;
      ;

      : use-counter
        make-counter var c
        "inc" &c dispatch
        "inc" &c dispatch
        "get" &c dispatch
      ;
      use-counter
    `;

    const stack = executeTacitCode(code);
    // After calling use-counter, the last value should be 2
    expect(stack[stack.length - 1]).toBe(2);
  });
});

