import { executeLine, setupInterpreter } from './executor';
import { parse } from './parser';
import { execute } from './interpreter';
import { Tokenizer } from './tokenizer';
import { initializeInterpreter } from '../core/globalState';

jest.mock('./parser');
jest.mock('./interpreter');
jest.mock('./tokenizer');
jest.mock('../core/globalState', () => ({
  initializeInterpreter: jest.fn(),
  vm: {
    compiler: {
      BCP: 123,
    },
  },
}));
describe('Executor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Tokenizer as jest.Mock).mockImplementation(() => ({ input: '' }));
    (parse as jest.Mock).mockImplementation(() => {});
    (execute as jest.Mock).mockImplementation(() => {});
  });
  describe('executeLine', () => {
    test('should tokenize, parse, and execute the input', () => {
      const input = '2 3 +';
      (Tokenizer as jest.Mock).mockImplementation(() => ({ input }));

      executeLine(input);

      expect(Tokenizer).toHaveBeenCalledWith(input);
      expect(parse).toHaveBeenCalledWith(expect.objectContaining({ input }));
      expect(execute).toHaveBeenCalledWith(123);
    });
    test('should propagate errors from tokenizer', () => {
      const input = 'invalid';
      const error = new Error('Tokenizer error');
      (Tokenizer as jest.Mock).mockImplementation(() => {
        throw error;
      });

      expect(() => executeLine(input)).toThrow('Tokenizer error');
      expect(parse).not.toHaveBeenCalled();
      expect(execute).not.toHaveBeenCalled();
    });
    test('should propagate errors from parser', () => {
      const input = 'unknown word';
      (parse as jest.Mock).mockImplementation(() => {
        throw new Error('Parser error');
      });

      expect(() => executeLine(input)).toThrow('Parser error');
      expect(execute).not.toHaveBeenCalled();
    });
    test('should propagate errors from execute', () => {
      const input = '+ +';
      (execute as jest.Mock).mockImplementation(() => {
        throw new Error('Execute error');
      });

      expect(() => executeLine(input)).toThrow('Execute error');
    });
    test('should handle empty input gracefully', () => {
      expect(() => executeLine('')).not.toThrow();
    });
  });
  describe('setupInterpreter', () => {
    test('should call initializeInterpreter', () => {
      setupInterpreter();

      expect(initializeInterpreter).toHaveBeenCalledTimes(1);
    });
  });
});
