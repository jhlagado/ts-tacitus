import { describe, it, expect, beforeEach } from '@jest/globals';
import { initializeInterpreter, vm } from '../../core/globalState';
import { executeProgram } from '../../lang/interpreter';
import { fromTaggedValue, Tag } from '../../core/tagged';

function stackDepth(): number { return vm.getStackData().length; }

describe('RLIST Memory Management Validation', () => {
  beforeEach(() => {
    initializeInterpreter();
  });

  it('creates and skips a large RLIST without leaving residual stack data', () => {
    executeProgram('( 1 2 3 4 5 6 7 8 9 10 )');
    const before = stackDepth();
    expect(before).toBe(11);

    // .skip equivalent via builtin op sequence: push header remains after execution
    // We can simulate skip by calling `.skip` if registered
    // Build bytecode to execute rlistSkipOp: header already at TOS
    const { tag } = fromTaggedValue(vm.peek());
    expect(tag).toBe(Tag.RLIST);

    // Use symbol table to call .skip
    executeProgram('.skip');
    expect(stackDepth()).toBe(0);
  });

  it('handles nested RLIST creation and skip in sequence', () => {
    executeProgram('( 1 ( 2 3 ) 4 )');
    expect(stackDepth()).toBeGreaterThan(0);
    executeProgram('.skip');
    expect(stackDepth()).toBe(0);
  });
});
