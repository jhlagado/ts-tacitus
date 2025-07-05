import { executeLine, setupInterpreter } from './executor';
import { Interpreter } from './interpreter';
import { initializeInterpreter } from '../core/globalState';

// Mock dependencies
jest.mock('./interpreter');
jest.mock('../core/globalState', () => ({
  initializeInterpreter: jest.fn(),
  vm: {
    compiler: {
      BP: 123, // Mock value for testing
    },
  },
}));

// Mock Interpreter class
const mockEval = jest.fn();
(Interpreter as jest.Mock).mockImplementation(() => ({
  eval: mockEval
}));

describe('Executor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset all mock implementations to prevent test interference
    mockEval.mockReset();
  });

  describe('executeLine', () => {
    it('should execute the input using the interpreter', () => {
      // Arrange
      const input = '2 3 +';

      // Act
      executeLine(input);

      // Assert
      expect(Interpreter).toHaveBeenCalledTimes(1);
      expect(mockEval).toHaveBeenCalledWith(input);
    });

    it('should propagate errors from interpreter', () => {
      // Arrange
      const input = 'invalid';
      const error = new Error('Tokenizer error');
      mockEval.mockImplementation(() => {
        throw error;
      });

      // Act & Assert
      expect(() => executeLine(input)).toThrow('Tokenizer error');
      expect(mockEval).toHaveBeenCalled();
    });

    it('should handle lines with comments', () => {
      // Arrange
      const input = '2 3 + \\ This is a comment';

      // Act
      executeLine(input);

      // Assert
      expect(mockEval).toHaveBeenCalledWith(input);
    });

    it('should propagate errors from interpreter eval', () => {
      // Arrange
      const input = '+ +';
      mockEval.mockImplementation(() => {
        throw new Error('Execute error');
      });

      // Act & Assert
      expect(() => executeLine(input)).toThrow('Execute error');
      expect(mockEval).toHaveBeenCalledWith(input);
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
