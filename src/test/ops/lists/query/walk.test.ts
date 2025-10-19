import { captureTacitOutput } from '../../../utils/vm-test-utils';

describe('List query: walk', () => {
  test('walk simple flat list cells', () => {
    const out = captureTacitOutput(`( 10 20 30 ) ref 0 walk raw walk raw walk raw`);
    expect(out).toEqual(['10', '20', '30']);
  });

  test('walk nested list payload yields numbers and a LIST ref', () => {
    const out = captureTacitOutput(`( 1 ( 2 3 ) 4 ) ref 0 walk raw walk raw walk raw walk raw`);
    // First output must be 1; among the next three outputs one is a ref, and the other two are 2 and 3 (order may vary)
    expect(out[0]).toBe('1');
    expect(out.slice(1).some(s => /^DATA_REF:/.test(s))).toBe(true);
    expect(out).toContain('2');
    expect(out).toContain('3');
  });

  test('walk out-of-range resets idx to 0 and yields NIL', () => {
    const out = captureTacitOutput(`( 7 8 ) ref 2 walk swap raw`);
    expect(out).toEqual(['0']);
  });

  test('walk nested ref fetch materializes for pretty print', () => {
    const out = captureTacitOutput(`( 1 ( 2 3 ) 4 ) ref 1 walk fetch .`);
    expect(out).toEqual(['( 2 3 )']);
  });
});
