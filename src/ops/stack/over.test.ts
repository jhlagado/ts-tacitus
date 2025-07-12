import { VM } from '../../core/vm';
import { overOp } from '../builtins-stack';
import { Tag, toTaggedValue } from '../../core/tagged';

describe('over Operation', () => {
  let vm: VM;

  beforeEach(() => {
    vm = new VM();
  });

  it('should duplicate the second item (simple values)', () => {
    // Push two simple values
    vm.push(1);
    vm.push(2);

    // Execute over
    overOp(vm);

    // Stack should now be [1, 2, 1]
    expect(vm.getStackData()).toEqual([1, 2, 1]);
  });

  xit('should duplicate the second item (list)', () => {
    // Clear the stack
    vm.SP = 0;

    // Push a simple value first
    vm.push(3);

    // Push a list [1, 2]
    // Stack after pushing list: [LIST, 1, 2, LINK, 3]
    const listSize = 2;  // Two elements in the list
    const listTag = toTaggedValue(Tag.LIST, listSize);
    const linkOffset = 3; // Points to the LIST tag (LIST + 2 elements + 1 for LINK itself)
    const linkTag = toTaggedValue(Tag.LINK, linkOffset);

    // Push the list structure
    vm.push(listTag);  // LIST tag with size 2
    vm.push(1);        // First element
    vm.push(2);        // Second element
    vm.push(linkTag);  // LINK tag pointing to LIST

    // Now the stack is: [LIST, 1, 2, LINK, 3]
    // We want to duplicate the list [1, 2] (which is the second item from the top)

    // Execute over - should duplicate the list [1, 2]
    overOp(vm);

    // Stack should now be: [LIST, 1, 2, LINK, 3, LIST, 1, 2, LINK]
    // expect(vm.SP).toBe(9 * BYTES_PER_ELEMENT);

    // Check the stack contents
    const stack = vm.getStackData();

    // Original list
    expect(stack[0]).toBe(listTag);  // LIST tag
    expect(stack[1]).toBe(1);        // First element
    expect(stack[2]).toBe(2);        // Second element
    expect(stack[3]).toBe(linkTag);  // LINK tag

    // Simple value on top
    expect(stack[4]).toBe(3);

    // Duplicated list (should be identical to the original list structure)
    expect(stack[5]).toBe(listTag);  // LIST tag (same value as original)
    expect(stack[6]).toBe(1);        // First element
    expect(stack[7]).toBe(2);        // Second element
    expect(stack[8]).toBe(linkTag);  // LINK tag (same value as original)
  });

  it('should throw on insufficient stack', () => {
    // Empty stack
    expect(() => overOp(vm)).toThrow('requires 2 operands');

    // Only one element
    vm.push(1);
    expect(() => overOp(vm)).toThrow('requires 2 operands');
  });
});
