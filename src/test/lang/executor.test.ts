import { parse } from '../../lang/parser';
import { execute } from '../../lang/interpreter';
import { Tokenizer } from '../../lang/tokenizer';
import { createVM, VM } from '../../core';

jest.mock('../../lang/parser');
jest.mock('../../lang/interpreter');
jest.mock('../../lang/tokenizer');

function executeLine(vm: VM, input: string): void {
  const tokenizer = new Tokenizer(input);
  parse(vm, tokenizer);
  execute(vm, vm.compiler.BCP);
}

describe('Executor', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
    jest.clearAllMocks();
    (Tokenizer as jest.Mock).mockImplementation(() => ({ input: '' }));
    (parse as jest.Mock).mockImplementation(() => {});
    (execute as jest.Mock).mockImplementation(() => {});
  });
  describe('executeLine', () => {
    test('should tokenize, parse, and execute the input', () => {
      const input = '2 3 +';
      (Tokenizer as jest.Mock).mockImplementation(() => ({ input }));
      executeLine(vm, input);
      expect(Tokenizer).toHaveBeenCalledWith(input);
      expect(parse).toHaveBeenCalledWith(vm, expect.objectContaining({ input }));
      expect(execute).toHaveBeenCalledWith(vm, vm.compiler.BCP);
    });
    test('should propagate errors from tokenizer', () => {
      const input = 'invalid';
      const error = new Error('Tokenizer error');
      (Tokenizer as jest.Mock).mockImplementation(() => {
        throw error;
      });

      expect(() => executeLine(vm, input)).toThrow('Tokenizer error');
      expect(parse).not.toHaveBeenCalled();
      expect(execute).not.toHaveBeenCalled();
    });
    test('should propagate errors from parser', () => {
      const input = 'unknown word';
      (parse as jest.Mock).mockImplementation(() => {
        throw new Error('Parser error');
      });

      expect(() => executeLine(vm, input)).toThrow('Parser error');
      expect(execute).not.toHaveBeenCalled();
    });
    test('should propagate errors from execute', () => {
      const input = '+ +';
      (execute as jest.Mock).mockImplementation(() => {
        throw new Error('Execute error');
      });

      expect(() => executeLine(vm, input)).toThrow('Execute error');
    });
    test('should handle empty input gracefully', () => {
      expect(() => executeLine(vm, '')).not.toThrow();
    });
  });
});
