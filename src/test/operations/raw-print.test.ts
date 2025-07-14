import { captureTacitOutput, executeTacitCode } from '../utils/test-utils';

describe('Raw print operation (xxx)', () => {
  beforeEach(() => {
    // Reset VM state before each test
    executeTacitCode('');
  });

  test('should print a simple number', () => {
    const output = captureTacitOutput('42 xxx');
    expect(output[0]).toBe('42');
  });

  test('should print a tagged value', () => {
    // This test will fail until we implement proper list creation in the VM
    // For now, we're just testing that the operation exists and runs
    const output = captureTacitOutput('(1 2) xxx');
    expect(output[0]).toMatch(/^LINK:\d+/);
  });

  test('should handle empty stack', () => {
    // This test will check error handling for empty stack
    const output = captureTacitOutput('xxx');
    expect(output[0]).toContain('Stack empty');
  });
});
