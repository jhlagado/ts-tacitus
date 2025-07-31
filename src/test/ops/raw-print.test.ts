import { captureTacitOutput, executeTacitCode } from '../utils/test-utils';

describe('Raw print operation', () => {
  beforeEach(() => {
    executeTacitCode('');
  });

  test('should print a simple number', () => {
    const output = captureTacitOutput('42 .');
    expect(output[0]).toBe('42');
  });

  test('should print a tagged value', () => {
    const output = captureTacitOutput('(1 2) .');
    expect(output[0]).toMatch(/^LINK:\d+/);
  });

  test('should handle empty stack', () => {
    const output = captureTacitOutput('.');
    expect(output[0]).toContain('Stack empty');
  });
});
