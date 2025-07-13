/**
 * Tests for the print operation (.)
 */
import { executeTacitCode, resetVM, captureTacitOutput } from '../testUtils';

describe('Print operation', () => {
  beforeEach(() => {
    resetVM();
  });

  test('should print atomic values correctly', () => {
    const output = captureTacitOutput('123 print');
    expect(output).toEqual(['123']);

    const floatOutput = captureTacitOutput('3.14 print');
    expect(floatOutput).toEqual(['3.14']);
  });

  test('should print simple lists correctly', () => {
    const output = captureTacitOutput('( 1 2 ) print');
    expect(output).toEqual(['( 1 2 )']);
  });

  test('should print nested lists correctly', () => {
    const output = captureTacitOutput('( 1 ( 2 3 ) 4 ) print');
    expect(output).toEqual(['( 1 ( 2 3 ) 4 )']);
  });

  test('should print when list is referenced via LINK tag', () => {
    executeTacitCode('( 10 20 )');

    const output = captureTacitOutput('print');
    expect(output).toEqual(['( 10 20 )']);
  });

  test('should print deeply nested structures', () => {
    const output = captureTacitOutput('( 1 ( 2 ( 3 4 ) 5 ) 6 ) print');
    expect(output).toEqual(['( 1 ( 2 ( 3 4 ) 5 ) 6 )']);
  });
});
