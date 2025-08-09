import {
  testTacitCode,
  executeTacitCode,
  runTacitTest,
  captureTacitOutput,
} from './utils/test-utils';
describe('tacitTestUtils', () => {
  describe('testTacitCode', () => {
    test('should validate stack output correctly', () => {
      expect(() => testTacitCode('5 3 add', [8])).not.toThrow();
    });
    test('should throw error for stack length mismatch', () => {
      expect(() => testTacitCode('5 3 add', [8, 1])).toThrow(/Stack length mismatch/);
    });
    test('should throw error for value mismatch', () => {
      expect(() => testTacitCode('5 3 add', [7])).toThrow(/Stack value mismatch/);
    });
    test('should handle floating-point precision', () => {
      expect(() => testTacitCode('0.1 0.2 add', [0.3])).not.toThrow();
    });
    test('should throw error for NaN values', () => {
      expect(() => testTacitCode('NaN', [NaN])).toThrow('Undefined word: NaN');
    });
    test('should throw error for non-numeric stack values', () => {
      expect(() => testTacitCode('5', ['string'] as unknown as number[])).toThrow(
        /Stack value is NaN at position 0: expected string, got 5/,
      );
    });
  });
  describe('executeTacitCode', () => {
    test('should execute Tacit code and return stack', () => {
      const result = executeTacitCode('5 3 add');
      expect(result).toEqual([8]);
    });
    test('should handle empty code', () => {
      const result = executeTacitCode('');
      expect(result).toEqual([]);
    });
    test('should handle complex stack operations', () => {
      const result = executeTacitCode('1 2 3 drop swap dup');
      expect(result).toEqual([2, 1, 1]);
    });
  });
  describe('captureTacitOutput', () => {
    test('should capture console output', () => {
      const output = captureTacitOutput('5 printx');
      expect(output).toEqual(['5']);
    });
    test('should handle multiple outputs', () => {
      const output = captureTacitOutput('5 3 add printx');
      expect(output).toEqual(['8']);
    });
    test('should handle empty output', () => {
      const output = captureTacitOutput('');
      expect(output).toEqual([]);
    });
  });
  describe('runTacitTest', () => {
    test('should execute Tacit code and return stack state', () => {
      const result = runTacitTest('5 3 add');
      expect(result).toEqual([8]);
    });
    test('should handle complex stack operations', () => {
      const result = runTacitTest('1 2 3 drop swap dup');
      expect(result).toEqual([2, 1, 1]);
    });
    test('should handle empty input', () => {
      const result = runTacitTest('');
      expect(result).toEqual([]);
    });
  });
});
