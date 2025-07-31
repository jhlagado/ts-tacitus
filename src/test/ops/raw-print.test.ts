import { captureTacitOutput, executeTacitCode } from '../utils/test-utils';

describe('Raw print operation', () => {
  beforeEach(() => {
    executeTacitCode('');
  });

  describe('simple values', () => {
    test('should print a simple number', () => {
      const output = captureTacitOutput('42 .');
      expect(output[0]).toBe('42');
    });
  });

  describe('list operations', () => {
    test('should print a tagged value', () => {
      const output = captureTacitOutput('(1 2) .');
      expect(output[0]).toMatch(/^LINK:\d+/);
    });
  });

  describe('error cases', () => {
    test('should handle empty stack', () => {
      const output = captureTacitOutput('.');
      expect(output[0]).toContain('Stack empty');
    });
  });

  describe('integration tests', () => {
    // TODO: Add complex integration tests for raw print operation
  });
});
