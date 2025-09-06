import { executeProgram } from '../../lang/interpreter';
import { resetVM } from '../utils/vm-test-utils';

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
  beforeEach(() => {
    resetVM();
  });

  test('redefinition shadows previous and new body can call old one', () => {
    const out = captureOutput(() => executeProgram(': x 123 . ; x : x x x ; x'));
    expect(out).toEqual(['123', '123', '123']);
  });
});
