/**
 * @file src/lang/parser.test.ts
 * Tests for the simplified Forth-like Tacit language parser
 */

import { vm } from '../core/globalState';
import { parse } from './parser';
import { Tokenizer } from './tokenizer';
import { Interpreter } from './interpreter';

// Mock the interpreter to verify how it's used
jest.mock('./interpreter', () => {
  const mockEval = jest.fn();
  
  return {
    Interpreter: jest.fn().mockImplementation(() => ({
      eval: mockEval
    }))
  };
});

describe('Parser with Tokenizer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    vm.reset();
  });
  
  it('should process input through the Interpreter', () => {
    parse(new Tokenizer('5 10 +'));
    
    // Verify that Interpreter was constructed
    expect(Interpreter).toHaveBeenCalledWith(vm);
    
    // Verify that eval was called with the correct input
    const interpreterInstance = (Interpreter as jest.Mock).mock.results[0].value;
    expect(interpreterInstance.eval).toHaveBeenCalledWith('5 10 +');
  });
  
  it('should handle backslash comments', () => {
    parse(new Tokenizer('5 \\ This is a comment\n10 +'));
    
    // Verify that Interpreter was constructed with vm
    expect(Interpreter).toHaveBeenCalledWith(vm);
    
    // Parser passes the input directly to the interpreter
    // Comment handling is done by the tokenizer when generating tokens
    const interpreterInstance = (Interpreter as jest.Mock).mock.results[0].value;
    expect(interpreterInstance.eval).toHaveBeenCalledWith('5 \\ This is a comment\n10 +');
  });
  
  it('should handle empty input', () => {
    parse(new Tokenizer(''));
    
    // Verify that eval was called with empty string
    const interpreterInstance = (Interpreter as jest.Mock).mock.results[0].value;
    expect(interpreterInstance.eval).toHaveBeenCalledWith('');
  });
  
  it('should handle input with only comments', () => {
    parse(new Tokenizer('\\ Just a comment'));
    
    // Verify that eval was still called with the input including comments
    const interpreterInstance = (Interpreter as jest.Mock).mock.results[0].value;
    expect(interpreterInstance.eval).toHaveBeenCalledWith('\\ Just a comment');
  });
});
