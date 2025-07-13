/**
 * Tests for the print operation (.)
 */
import { executeTacitCode, resetVM, captureTacitOutput } from '../testUtils';

describe('Print operation', () => {
  beforeEach(() => {
    resetVM();
  });

  test('should print atomic values correctly', () => {
    const output = captureTacitOutput('123 .');
    expect(output).toEqual(['123']);

    const floatOutput = captureTacitOutput('3.14 .');
    expect(floatOutput).toEqual(['3.14']);
  });

  test('should print simple lists correctly', () => {
    // Create a list with two elements and print it
    const output = captureTacitOutput('( 1 2 ) .');
    expect(output).toEqual(['( 1 2 )']);
  });

  test('should print nested lists correctly', () => {
    // Create a nested list and print it
    const output = captureTacitOutput('( 1 ( 2 3 ) 4 ) .');
    expect(output).toEqual(['( 1 ( 2 3 ) 4 )']);
  });

  test('should print when list is referenced via LINK tag', () => {
    // A list on the stack has both LIST and LINK tags
    // This test ensures printing works correctly when
    // we're at the LINK tag (the normal case after creating a list)
    executeTacitCode('( 10 20 )');

    // The stack now should have LIST-10-20-LINK structure
    // Check that we can print it
    const output = captureTacitOutput('.');
    expect(output).toEqual(['( 10 20 )']);
  });

  test('should print deeply nested structures', () => {
    // Create a complex nested list structure
    const output = captureTacitOutput('( 1 ( 2 ( 3 4 ) 5 ) 6 ) .');
    expect(output).toEqual(['( 1 ( 2 ( 3 4 ) 5 ) 6 )']);
  });
});
