import { executeProgram } from '../../lang/interpreter';
import { createVM, type VM } from '../../core/vm';

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
});
