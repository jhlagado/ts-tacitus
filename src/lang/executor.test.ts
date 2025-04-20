import { executeLine, setupInterpreter } from './executor';
import { parse } from './parser';
import { execute } from './interpreter';
import { Tokenizer } from './tokenizer';
import { initializeInterpreter } from '../core/globalState';

// Mock dependencies
jest.mock('./parser');
jest.mock('./interpreter');
jest.mock('./tokenizer');
jest.mock('../core/globalState', () => ({
  initializeInterpreter: jest.fn(),
  vm: {
    compiler: {
      BP: 123, // Mock value for testing
    },
  },
}));

describe('Executor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset all mock implementations to prevent test interference
    (Tokenizer as jest.Mock).mockImplementation(() => ({ input: '' }));
    (parse as jest.Mock).mockImplementation(() => {});
    (execute as jest.Mock).mockImplementation(() => {});
  });

  describe('executeLine', () => {
    it('should tokenize, parse, and execute the input', () => {
      // Arrange
      const input = '2 3 +';
      (Tokenizer as jest.Mock).mockImplementation(() => ({ input }));

      // Act
      executeLine(input);

      // Assert
      expect(Tokenizer).toHaveBeenCalledWith(input);
      expect(parse).toHaveBeenCalledWith(expect.objectContaining({ input }));
      expect(execute).toHaveBeenCalledWith(123); // The mock BP value
    });

    it('should propagate errors from tokenizer', () => {
      // Arrange
      const input = 'invalid';
      const error = new Error('Tokenizer error');
      (Tokenizer as jest.Mock).mockImplementation(() => {
        throw error;
      });

      // Act & Assert
      expect(() => executeLine(input)).toThrow('Tokenizer error');
      expect(parse).not.toHaveBeenCalled();
      expect(execute).not.toHaveBeenCalled();
    });

    it('should propagate errors from parser', () => {
      // Arrange
      const input = 'unknown word';
      (parse as jest.Mock).mockImplementation(() => {
        throw new Error('Parser error');
      });

      // Act & Assert
      expect(() => executeLine(input)).toThrow('Parser error');
      expect(execute).not.toHaveBeenCalled();
    });

    it('should propagate errors from execute', () => {
      // Arrange
      const input = '+ +';
      (execute as jest.Mock).mockImplementation(() => {
        throw new Error('Execute error');
      });

      // Act & Assert
      expect(() => executeLine(input)).toThrow('Execute error');
    });

    it('should handle empty input gracefully', () => {
      expect(() => executeLine('')).not.toThrow();
    });
  });

  describe('setupInterpreter', () => {
    it('should call initializeInterpreter', () => {
      // Act
      setupInterpreter();

      // Assert
      expect(initializeInterpreter).toHaveBeenCalledTimes(1);
    });
  });
});
