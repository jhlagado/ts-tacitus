import { describe, it, expect, beforeEach } from '@jest/globals';
import { parse } from '../lang/parser';
import { Tokenizer } from '../lang/tokenizer';
import { fromTaggedValue, Tag } from '../core/tagged';
import { execute } from '../lang/interpreter';
import { vm, initializeInterpreter } from '../core/globalState';

describe('Tuple operations', () => {
  // Reset VM before each test
  beforeEach(() => {
    // Initialize fresh VM
    initializeInterpreter();
    
    // Reset state
    vm.SP = 0;
    vm.RP = 0;
    vm.BP = 0;
    vm.IP = 0;
    vm.tupleDepth = 0;
    vm.compiler.reset();
  });

  it('should create a simple tuple with 2 elements', () => {
    const code = '( 1 2 )';
    const tokenizer = new Tokenizer(code);
    parse(tokenizer);
    
    // Execute the compiled code
    execute(0);
    
    // Check stack: should have [1, 2, TUPLE(2), STACK_REF]
    const stack = vm.getStackData();
    expect(stack.length).toBe(4);
    
    // The last item should be a stack reference (tuple start)
    const stackRef = stack[3];
    const { tag: refTag } = fromTaggedValue(stackRef);
    expect(refTag).toBe(Tag.STACK_REF);
    
    // The second-to-last item should be a tuple tag with size = 2
    const tupleTag = stack[2];
    const { value: size, tag } = fromTaggedValue(tupleTag);
    expect(tag).toBe(Tag.TUPLE);
    expect(size).toBe(2);
    
    // The first two items should be the values 1 and 2
    expect(stack[0]).toBe(1);
    expect(stack[1]).toBe(2);
  });

  it('should handle empty tuples', () => {
    const code = '( )';
    const tokenizer = new Tokenizer(code);
    parse(tokenizer);
    
    execute(0);
    
    const stack = vm.getStackData();
    expect(stack.length).toBe(2);
    
    // Check the tuple tag
    const tupleTag = stack[0];
    const { value: size, tag } = fromTaggedValue(tupleTag);
    expect(tag).toBe(Tag.TUPLE);
    expect(size).toBe(0);
    
    // Check the reference
    const stackRef = stack[1];
    const { tag: refTag } = fromTaggedValue(stackRef);
    expect(refTag).toBe(Tag.STACK_REF);
  });
});
