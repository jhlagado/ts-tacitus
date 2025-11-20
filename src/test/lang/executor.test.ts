import { parse } from '../../lang/parser';
import { execute } from '../../lang/interpreter';
import * as tokenizerModule from '../../lang/tokenizer';
import { createVM, VM } from '../../core';

jest.mock('../../lang/parser');
jest.mock('../../lang/interpreter');

function executeLine(vm: VM, input: string): void {
  const tokenizer = tokenizerModule.createTokenizer(input);
  parse(vm, tokenizer);
  execute(vm, vm.compiler.BCP);
}

describe('Executor', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
    jest.clearAllMocks();
    (parse as jest.Mock).mockImplementation(() => {});
    (execute as jest.Mock).mockImplementation(() => {});
  });
  describe('executeLine', () => {
    test('should tokenize, parse, and execute the input', () => {
      const input = '2 3 +';
      
      executeLine(vm, input);
      
      expect(parse).toHaveBeenCalledWith(vm, expect.objectContaining({ input }));
      expect(execute).toHaveBeenCalledWith(vm, vm.compiler.BCP);
    });
    test('should propagate errors from tokenizer', () => {
      const input = 'invalid';
      const error = new Error('Tokenizer error');
      const spy = jest.spyOn(tokenizerModule, 'createTokenizer').mockImplementation(() => {
        throw error;
      });

      expect(() => executeLine(vm, input)).toThrow('Tokenizer error');
      expect(parse).not.toHaveBeenCalled();
      expect(execute).not.toHaveBeenCalled();
      spy.mockRestore();
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
