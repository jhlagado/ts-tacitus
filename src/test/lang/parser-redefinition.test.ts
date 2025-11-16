import { executeProgram } from '../../lang/interpreter';
import { createVM, getStackData, type VM } from '../../core/vm';

function captureOutput(run: () => void): string[] {
  const logs: string[] = [];
  const original = console.log;
  try {
    console.log = (msg: string) => {
      logs.push(String(msg));
    };
    run();
    return logs;
  } finally {
    console.log = original;
  }
}

describe('Forth-style word redefinition (shadowing)', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('redefinition shadows previous and new body can call old one', () => {
    const out = captureOutput(() => executeProgram(vm, ': x 123 . ; x : x x x ; x'));
    expect(out).toEqual(['123', '123', '123']);
  });

  test('recurse emits self-call within active definition', () => {
    executeProgram(
      vm,
      `
        : fact
          dup 1 le
          if
            drop 1
          else
            dup 1 sub
            recurse
            mul
          ;
        ;
        5 fact
      `,
    );

    expect(getStackData(vm)).toEqual([120]);
  });

  test('tail-recursive definition unwinds stack', () => {
    executeProgram(
      vm,
      `
        : countdown
          dup 0 gt
          if
            1 sub
            recurse
          else
            drop
          ;
        ;
        10 countdown
      `,
    );

    expect(getStackData(vm)).toEqual([]);
  });

  test('recurse targets most recent definition after redefinition', () => {
    executeProgram(
      vm,
      `
        : pulse
          dup 0 gt
          if 1 sub recurse else drop ;
        ;
        : pulse
          dup 0 gt
          if
            1 sub
            recurse
            1 add
          else
            drop 0
          ;
        ;
        4 pulse
      `,
    );

    expect(getStackData(vm)).toEqual([4]);
  });
});
