import { Tag, fromTaggedValue, toTaggedValue } from '../../../core';
import { vm } from '../../../lang/runtime';
import { binaryFlat, binaryRecursive, unaryFlat, unaryRecursive } from '../../../ops/broadcast';
import {
  resetVM,
  extractListFromStack,
  pushTestList,
  executeTacitCode,
} from '../../utils/vm-test-utils';

describe('broadcast helpers', () => {
  beforeEach(() => {
    resetVM();
  });

  describe('unaryFlat', () => {
    test('applies function to simple scalar', () => {
      vm.push(5);
      unaryFlat(vm, 'neg', x => -x);
      expect(vm.getStackData()).toEqual([-5]);
    });

    test('transforms list payload in place', () => {
      pushTestList(vm, [1, -2, 3]);

      unaryFlat(vm, 'abs', Math.abs);

      const stack = vm.getStackData();
      const headerIndex = stack.length - 1;
      const header = fromTaggedValue(stack[headerIndex]);
      expect(header.tag).toBe(Tag.LIST);
      expect(header.value).toBe(3);
      expect(extractListFromStack(stack, headerIndex)).toEqual([1, 2, 3]);
    });

    test('returns immediately for empty list', () => {
      pushTestList(vm, []);

      unaryFlat(vm, 'abs', Math.abs);

      const stack = vm.getStackData();
      expect(stack).toHaveLength(1);
      const header = fromTaggedValue(stack[0]);
      expect(header.tag).toBe(Tag.LIST);
      expect(header.value).toBe(0);
    });

    test('throws stack underflow when no operands', () => {
      expect(() => unaryFlat(vm, 'neg', x => -x)).toThrow(/Stack underflow/);
    });
  });

  describe('binaryFlat', () => {
    test('simple × simple delegates to numeric op', () => {
      vm.push(4);
      vm.push(5);

      binaryFlat(vm, 'add', (a, b) => a + b);

      expect(vm.getStackData()).toEqual([9]);
    });

    test('list × list cycles shorter operand', () => {
      executeTacitCode('( 1 2 ) ( 10 20 30 )');

      binaryFlat(vm, 'add', (a, b) => a + b);

      const stack = vm.getStackData();
      const headerIndex = stack.length - 1;
      const header = fromTaggedValue(stack[headerIndex]);
      expect(header.tag).toBe(Tag.LIST);
      expect(header.value).toBe(3);
      const actual = extractListFromStack(stack, headerIndex);
      expect(actual.slice().reverse()).toEqual([11, 22, 31]);
    });

    test('scalar × list applies op across RHS payload', () => {
      executeTacitCode('5 ( 1 2 3 )');

      binaryFlat(vm, 'add', (a, b) => a + b);

      const stack = vm.getStackData();
      const headerIndex = stack.length - 1;
      const actual = extractListFromStack(stack, headerIndex);
      expect(actual.slice().reverse()).toEqual([6, 7, 8]);
    });

    test('scalar × empty list produces empty list', () => {
      executeTacitCode('7 0 pack');

      binaryFlat(vm, 'add', (a, b) => a + b);

      const stack = vm.getStackData();
      expect(stack).toHaveLength(1);
      const header = fromTaggedValue(stack[0]);
      expect(header.tag).toBe(Tag.LIST);
      expect(header.value).toBe(0);
    });

    test('list × scalar applies op across LHS payload', () => {
      executeTacitCode('( 2 4 6 ) 3');

      binaryFlat(vm, 'add', (a, b) => a + b);

      const stack = vm.getStackData();
      const headerIndex = stack.length - 1;
      const actual = extractListFromStack(stack, headerIndex);
      expect(actual.slice().reverse()).toEqual([5, 7, 9]);
    });

    test('list × scalar with empty list yields empty list', () => {
      executeTacitCode('( ) 42');

      binaryFlat(vm, 'add', (a, b) => a + b);

      const stack = vm.getStackData();
      expect(stack).toHaveLength(1);
      const header = fromTaggedValue(stack[0]);
      expect(header.tag).toBe(Tag.LIST);
      expect(header.value).toBe(0);
    });

    test('throws stack underflow when operands missing', () => {
      vm.push(1);
      expect(() => binaryFlat(vm, 'add', (a, b) => a + b)).toThrow(/Stack underflow/);
    });
  });

  describe('unaryRecursive', () => {
    test('duplicates list and increments every numeric payload cell', () => {
      executeTacitCode('( ( 1 2 ) 3 )');

      const before = vm.getStackData();

      unaryRecursive(vm, 'inc', x => x + 1);

      const after = vm.getStackData();
      expect(after).toHaveLength(before.length);

      const decoded = after.map(value => fromTaggedValue(value));
      const listHeaders = decoded
        .filter(entry => entry.tag === Tag.LIST)
        .map(entry => entry.value)
        .sort((a, b) => a - b);
      expect(listHeaders).toEqual([2, 4]);

      const numericValues = decoded
        .filter(entry => entry.tag === Tag.NUMBER)
        .map(entry => entry.value)
        .sort((a, b) => a - b);

      expect(numericValues).toEqual([2, 3, 4]);
    });

    test('throws when scalar operand is non-numeric', () => {
      vm.push(toTaggedValue(0, Tag.STRING));
      expect(() => unaryRecursive(vm, 'sqrt', Math.sqrt)).toThrow('broadcast type mismatch');
    });
  });

  describe('binaryRecursive', () => {
    test('scalar × nested list (scalar on left) recurses', () => {
      executeTacitCode('5 ( ( 1 2 ) 3 )');

      binaryRecursive(vm, 'add', (a, b) => a + b);

      const snapshot = vm.getStackData().map(value => fromTaggedValue(value));
      expect(snapshot).toEqual([
        { tag: Tag.LIST, value: 2, meta: 0 },
        { tag: Tag.NUMBER, value: 6, meta: 0 },
        { tag: Tag.NUMBER, value: 7, meta: 0 },
        { tag: Tag.NUMBER, value: 8, meta: 0 },
        { tag: Tag.LIST, value: 4, meta: 0 },
      ]);
    });

    test('raises mismatch when encountering non-number in list payload', () => {
      vm.push(2);
      pushTestList(vm, [toTaggedValue(0, Tag.STRING)]);
      expect(() => binaryRecursive(vm, 'add', (a, b) => a + b)).toThrow('broadcast type mismatch');
    });

    test('raises mismatch for simple × simple non-numeric pair', () => {
      vm.push(toTaggedValue(0, Tag.STRING));
      vm.push(toTaggedValue(1, Tag.STRING));
      expect(() => binaryRecursive(vm, 'add', (a, b) => a + b)).toThrow('broadcast type mismatch');
    });
  });
});
