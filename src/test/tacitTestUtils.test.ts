import {
  testTacitCode,
  executeTacitCode,
  captureTacitOutput,
  runTacitTest,
} from './tacitTestUtils';

describe('tacitTestUtils', () => {
  describe('testTacitCode', () => {
    it('should validate stack output correctly', () => {
      expect(() => testTacitCode('5 3 add', [8])).not.toThrow();
    });

    it('should throw error for stack length mismatch', () => {
      expect(() => testTacitCode('5 3 add', [8, 1])).toThrow(/Stack length mismatch/);
    });

    it('should throw error for value mismatch', () => {
      expect(() => testTacitCode('5 3 add', [7])).toThrow(/Stack value mismatch/);
    });

    it('should handle floating-point precision', () => {
      expect(() => testTacitCode('0.1 0.2 add', [0.3])).not.toThrow();
    });

    it('should throw error for NaN values', () => {
      expect(() => testTacitCode('NaN', [NaN])).toThrow(/Unknown word: NaN/);
    });

    it('should throw error for non-numeric stack values', () => {
      expect(() => testTacitCode('5', ['string'] as unknown as number[])).toThrow(
        /Stack value is NaN at position 0: expected string, got 5/
      );
    });
  });

  describe('executeTacitCode', () => {
    it('should execute Tacit code and return stack', () => {
      const result = executeTacitCode('5 3 add');
      expect(result).toEqual([8]);
    });

    it('should handle empty code', () => {
      const result = executeTacitCode('');
      expect(result).toEqual([]);
    });

    it('should handle complex stack operations', () => {
      const result = executeTacitCode('1 2 3 drop swap dup');
      expect(result).toEqual([2, 1, 1]);
    });
  });

  describe('captureTacitOutput', () => {
    it('should capture console output', () => {
      const output = captureTacitOutput('5 .');
      expect(output).toEqual(['5']);
    });

    it('should handle multiple outputs', () => {
      const output = captureTacitOutput('5 3 add .');
      expect(output).toEqual(['8']);
    });

    it('should handle empty output', () => {
      const output = captureTacitOutput('');
      expect(output).toEqual([]);
    });
  });

  describe('runTacitTest', () => {
    it('should execute Tacit code and return stack state', () => {
      const result = runTacitTest('5 3 add');
      expect(result).toEqual([8]);
    });

    it('should handle complex stack operations', () => {
      const result = runTacitTest('1 2 3 drop swap dup');
      expect(result).toEqual([2, 1, 1]);
    });

    it('should handle empty input', () => {
      const result = runTacitTest('');
      expect(result).toEqual([]);
    });
  });
});
