import { runTacitTest } from '../../utils/vm-test-utils';

describe('Unary broadcasting: neg', () => {

  test('simple value', () => {
    const stack = runTacitTest('5 neg');
    expect(stack).toEqual([-5]);
  });

  test('flat list', () => {
    const stack = runTacitTest('( 1 2 3 ) neg unpack');
    expect(stack).toEqual([-1, -2, -3]);
  });

  // Nested broadcasting will be covered in a later phase once flat cases are fully stabilized.

  test('empty list', () => {
    const stack = runTacitTest('( ) neg length');
    expect(stack).toEqual([0]);
  });
});
