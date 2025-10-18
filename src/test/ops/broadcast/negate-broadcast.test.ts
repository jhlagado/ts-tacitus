import { runTacitTest, captureTacitOutput } from '../../utils/vm-test-utils';

describe('Unary broadcasting: neg', () => {
  test('simple value', () => {
    const stack = runTacitTest('5 neg');
    expect(stack).toEqual([-5]);
  });

  test('flat list', () => {
    const out = captureTacitOutput('( 1 2 3 ) neg .');
    expect(out).toEqual(['( -1 -2 -3 )']);
  });

  test('nested list (pretty-printed assertions)', () => {
    // Baseline: non-broadcast nested element read
    const baseline = captureTacitOutput('( ( 1 2 ) 3 ) 0 elem fetch .');
    expect(baseline).toEqual(['( 1 2 )']);

    // Whole result pretty
    const pretty = captureTacitOutput('( ( 1 2 ) 3 ) neg .');
    expect(pretty).toEqual(['( ( -1 -2 ) -3 )']);

    // First element pretty
    const firstPretty = captureTacitOutput('( ( 1 2 ) 3 ) neg 0 elem fetch .');
    expect(firstPretty).toEqual(['( -1 -2 )']);

    // Second element pretty (simple)
    const secondPretty = captureTacitOutput('( ( 1 2 ) 3 ) neg 1 elem fetch .');
    expect(secondPretty).toEqual(['-3']);

    // Element count preserved
    const lengths = runTacitTest('( ( 1 2 ) 3 ) neg size');
    expect(lengths).toEqual([2]);
  });

  test('empty list', () => {
    const out = captureTacitOutput('( ) neg .');
    expect(out).toEqual(['()']);
  });
});
