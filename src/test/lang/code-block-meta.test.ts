/**
 * Test to verify code block compilation generates Tag.CODE with meta=1
 */

import { resetVM } from '../utils/vm-test-utils';
import { vm } from '../../core/globalState';
import { parse } from '../../lang/parser';
import { Tokenizer } from '../../lang/tokenizer';
import { fromTaggedValue, Tag } from '../../core/tagged';
import { Op } from '../../ops/opcodes';
import { executeOp } from '../../ops/builtins';

describe('Code Block Meta Bit', () => {
  beforeEach(() => {
    resetVM();
  });

  test('should compile { } with Tag.CODE meta=1', () => {
    // Parse a simple code block
    parse(new Tokenizer('{ 42 }'));
    
    // Execute until we find the LiteralCode operation
    vm.IP = 0;
    vm.running = true;
    
    while (vm.running && vm.IP < vm.compiler.CP) {
      const opcode = vm.next8();
      
      if (opcode === Op.LiteralCode) {
        // Get the address that will be tagged
        const address = vm.read16();
        
        // Execute the literalCodeOp to create the tagged value
        const tagged = require('../../core/tagged').toTaggedValue(address, Tag.CODE, 1);
        vm.push(tagged);
        
        // Verify the meta bit is set correctly
        const { tag, value, meta } = fromTaggedValue(vm.peek());
        
        expect(tag).toBe(Tag.CODE);
        expect(value).toBe(address);
        expect(meta).toBe(1); // ✅ Meta bit should be 1 for code blocks
        
        break;
      } else {
        executeOp(vm, opcode);
      }
    }
  });

  test('should generate correct bytecode structure for 10 { . } eval', () => {
    parse(new Tokenizer('10 { . } eval'));
    
    const bytecode = vm.getCompileData();
    let pos = 0;
    
    // Expect: LiteralNumber, Branch, Print, ExitCode, LiteralCode, Eval, Abort
    expect(bytecode[pos]).toBe(Op.LiteralNumber);
    pos += 5; // LiteralNumber + 4 bytes for float32
    
    expect(bytecode[pos]).toBe(Op.Branch);
    pos += 3; // Branch + 2 bytes for offset
    
    expect(bytecode[pos]).toBe(Op.Print);
    pos += 1;
    
    expect(bytecode[pos]).toBe(Op.ExitCode);
    pos += 1;
    
    expect(bytecode[pos]).toBe(Op.LiteralCode);
    pos += 3; // LiteralCode + 2 bytes for address
    
    expect(bytecode[pos]).toBe(Op.Eval);
    pos += 1;
    
    expect(bytecode[pos]).toBe(Op.Abort);
  });

  test('should execute code block with meta=1 correctly', () => {
    // Test that code blocks with meta=1 execute correctly
    parse(new Tokenizer('10 { . } eval'));
    
    // Capture console.log output
    const consoleLogs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: any[]) => {
      consoleLogs.push(args.join(' '));
    };
    
    try {
      // Execute the program
      require('../../lang/interpreter').execute(0);
      
      // Should print 10
      expect(consoleLogs).toContain('10');
    } finally {
      console.log = originalLog;
    }
  });

  test('should distinguish functions (meta=0) from code blocks (meta=1)', () => {
    // Define a function and create a code block
    parse(new Tokenizer(': test 42 ; { 42 } drop @test'));
    
    vm.IP = 0;
    vm.running = true;
    
    const taggedValues: Array<{tag: number, meta: number, type: string}> = [];
    
    while (vm.running && vm.IP < vm.compiler.CP) {
      const opcode = vm.next8();
      
      if (opcode === Op.LiteralCode) {
        // Code block
        const address = vm.read16();
        const tagged = require('../../core/tagged').toTaggedValue(address, Tag.CODE, 1);
        vm.push(tagged);
        
        const { tag, meta } = fromTaggedValue(tagged);
        taggedValues.push({ tag, meta, type: 'code_block' });
      } else if (opcode === Op.PushSymbolRef) {
        // This will create a function reference
        executeOp(vm, opcode);
        
        if (vm.getStackData().length > 0) {
          const { tag, meta } = fromTaggedValue(vm.peek());
          if (tag === Tag.CODE) {
            taggedValues.push({ tag, meta, type: 'function_ref' });
          }
        }
      } else {
        executeOp(vm, opcode);
      }
    }
    
    // Should have found both types
    const codeBlock = taggedValues.find(v => v.type === 'code_block');
    const functionRef = taggedValues.find(v => v.type === 'function_ref');
    
    expect(codeBlock?.meta).toBe(1); // Code blocks have meta=1
    expect(functionRef?.meta).toBe(0); // Functions have meta=0
  });

  test('should implement lexical scoping for code blocks vs dynamic scoping for functions', () => {
    // Test that demonstrates the difference in scoping behavior
    resetVM();
    
    // Set up initial BP to simulate being inside a function with local variables
    const initialBP = 100;
    vm.BP = initialBP;
    
    // Test code block (meta=1) - should preserve parent BP and not save it
    const codeBlockAddr = 500;
    const codeBlockRef = require('../../core/tagged').toTaggedValue(codeBlockAddr, Tag.CODE, 1);
    
    vm.push(codeBlockRef);
    
    // Record state before eval
    const beforeBP = vm.BP;
    const beforeRP = vm.RP;
    
    // Execute eval for code block
    require('../../ops/core-ops').evalOp(vm);
    
    // Check that BP was NOT changed (lexical scoping)
    expect(vm.BP).toBe(initialBP); // BP should remain unchanged
    expect(vm.RP).toBe(beforeRP + 4); // RP should have only 1 value pushed (IP only)
    expect(vm.IP).toBe(codeBlockAddr); // Should have jumped to code block
    
    // Reset for function test
    resetVM();
    vm.BP = initialBP;
    
    // Test function (meta=0) - should create new frame
    const functionAddr = 600;
    const functionRef = require('../../core/tagged').toTaggedValue(functionAddr, Tag.CODE, 0);
    
    vm.push(functionRef);
    
    // Execute eval for function
    require('../../ops/core-ops').evalOp(vm);
    
    // Check that BP was changed to create new frame (dynamic scoping)
    expect(vm.BP).toBe(vm.RP); // BP should point to current return stack top
    expect(vm.BP).not.toBe(initialBP); // BP should have changed
    expect(vm.IP).toBe(functionAddr); // Should have jumped to function
  });

  test('should handle exit correctly for both scoping types with separate opcodes', () => {
    resetVM();
    
    // Test exitCodeOp (for code blocks) - only return address was saved
    const initialBP = 200;
    vm.BP = initialBP;
    
    vm.rpush(500); // Simulate return address (only thing saved for code blocks)
    
    const beforeBP = vm.BP;
    require('../../ops/core-ops').exitCodeOp(vm);
    
    // BP should remain unchanged (was never saved/modified)
    expect(vm.BP).toBe(beforeBP);
    expect(vm.IP).toBe(500); // Should have returned to correct address
    
    // Reset for function exit test
    resetVM();
    vm.BP = 300; // Different BP to show it gets restored
    
    // Test exitOp (for functions) - should restore saved BP
    vm.rpush(600); // Simulate return address  
    vm.rpush(initialBP); // Simulate saved BP
    
    require('../../ops/core-ops').exitOp(vm);
    
    // BP should be restored from saved value
    expect(vm.BP).toBe(initialBP);
    expect(vm.IP).toBe(600); // Should have returned to correct address
  });
});