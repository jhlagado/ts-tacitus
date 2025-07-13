import { dupOp } from '../builtins-stack';
import { Tag, toTaggedValue } from '../../../core/tagged';
import { initializeInterpreter, vm } from '../../../core/globalState';

describe('dup Operation', () => {
  beforeEach(() => {
    initializeInterpreter();
  });

  test('should duplicate a simple value', () => {
    vm.push(5);
    dupOp(vm);
    expect(vm.getStackData()).toEqual([5, 5]);
  });

  test('should duplicate a list', () => {
    const listTag = toTaggedValue(3, Tag.LIST);
    const linkTag = toTaggedValue(4, Tag.LINK);

    vm.push(listTag);
    vm.push(10);
    vm.push(20);
    vm.push(30);
    vm.push(linkTag);

    dupOp(vm);

    expect(vm.pop()).toBe(linkTag);
    expect(vm.pop()).toBe(30);
    expect(vm.pop()).toBe(20);
    expect(vm.pop()).toBe(10);
    expect(vm.pop()).toBe(listTag);

    expect(vm.pop()).toBe(linkTag);
    expect(vm.pop()).toBe(30);
    expect(vm.pop()).toBe(20);
    expect(vm.pop()).toBe(10);
    expect(vm.pop()).toBe(listTag);
  });

  test('should throw on empty stack', () => {
    expect(() => dupOp(vm)).toThrow(
      `Stack underflow: 'dup' requires 1 operand (stack: ${JSON.stringify(vm.getStackData())})`,
    );
  });
});
