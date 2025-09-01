import { executeTacitCode, resetVM } from '../../utils/vm-test-utils';

describe('Concat operation scenarios', () => {
  beforeEach(() => {
    resetVM();
  });

  test('simple + simple -> ( 1 2 )', () => {
    const result = executeTacitCode('1 2 concat');
    resetVM();
    const expected = executeTacitCode('( 1 2 )');
    expect(result).toEqual(expected);
  });

  test('simple + list (prepend) -> ( 1 2 3 )', () => {
    const result = executeTacitCode('1 ( 2 3 ) concat');
    resetVM();
    const expected = executeTacitCode('( 1 2 3 )');
    expect(result).toEqual(expected);
  });

  test('list + simple (append) -> ( 1 2 3 )', () => {
    const result = executeTacitCode('( 1 2 ) 3 concat');
    resetVM();
    const expected = executeTacitCode('( 1 2 3 )');
    expect(result).toEqual(expected);
  });

  test('list + list (flat) -> ( 1 2 3 4 )', () => {
    const result = executeTacitCode('( 1 2 ) ( 3 4 ) concat');
    resetVM();
    const expected = executeTacitCode('( 1 2 3 4 )');
    expect(result).toEqual(expected);
  });

  test('empty + list -> list', () => {
    const result = executeTacitCode('( ) ( 7 8 ) concat');
    resetVM();
    const expected = executeTacitCode('( 7 8 )');
    expect(result).toEqual(expected);
  });

  test('list + empty -> list', () => {
    const result = executeTacitCode('( 7 8 ) ( ) concat');
    resetVM();
    const expected = executeTacitCode('( 7 8 )');
    expect(result).toEqual(expected);
  });

  test('empty + empty -> empty', () => {
    const result = executeTacitCode('( ) ( ) concat');
    resetVM();
    const expected = executeTacitCode('( )');
    expect(result).toEqual(expected);
  });

  test('nested elements preserved as units', () => {
    const result = executeTacitCode('( ( 1 2 ) 3 ) ( 4 ( 5 ) ) concat');
    resetVM();
    const expected = executeTacitCode('( ( 1 2 ) 3 4 ( 5 ) )');
    expect(result).toEqual(expected);
  });
});
