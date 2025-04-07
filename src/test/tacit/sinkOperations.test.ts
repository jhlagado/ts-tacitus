
import { vm } from '../../core/globalState';
import { captureTacitOutput } from '../tacitTestUtils';

describe('Tacit Sequence Operations', () => {
  test('debug for-each operation', () => {
    vm.debug = true; // Enable debug mode
    // Simplified test to debug stack underflow
    const output = captureTacitOutput('1 5 1 range (.) for-each');

    // Validate the printed output
    expect(output).toEqual(['1', '2', '3', '4', '5']);
  });

  test('debug for-each operation', () => {
    vm.debug = true; // Enable debug mode
    // empty map function
    const output = captureTacitOutput('1 5 1 range () map (.) for-each');

    // Validate the printed output
    expect(output).toEqual(['1', '2', '3', '4', '5']);
  });

  test('debug for-each operation', () => {
    vm.debug = true; // Enable debug mode
    // doubling map function
    const output = captureTacitOutput('1 5 1 range (2 *) map (.) for-each');

    // Validate the printed output
    expect(output).toEqual(['2', '4', '6', '8', '10']);
  });
});
