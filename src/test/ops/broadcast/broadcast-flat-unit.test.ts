import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, type VM, getStackData } from '../../../core/vm';
import { unaryFlat, binaryFlat } from '../../../ops/broadcast';
import { pushListLiteral, pushNumber } from '../../utils/vm-test-utils';
import { Tagged, Tag } from '../../../core/tagged';

const add = (a: number, b: number): number => a + b;
const double = (x: number): number => x * 2;

describe('broadcast helpers (flat)', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  describe('unaryFlat', () => {
    test('applies scalar function to single value', () => {
      pushNumber(vm, 7);

      unaryFlat(vm, 'double', double);

      expect(getStackData(vm)).toEqual([14]);
    });

    test('maps over list payloads', () => {
      pushListLiteral(vm, 1, 2, 3);

      unaryFlat(vm, 'double', double);

      expect(getStackData(vm)).toEqual([2, 4, 6, Tagged(3, Tag.LIST)]);
    });

    test('preserves empty lists without invoking op', () => {
      pushListLiteral(vm);

      unaryFlat(vm, 'double', double);

      expect(getStackData(vm)).toEqual([Tagged(0, Tag.LIST)]);
    });
  });

  describe('binaryFlat', () => {
    test('handles simple × simple operations', () => {
      pushNumber(vm, 2);
      pushNumber(vm, 3);

      binaryFlat(vm, 'add', add);

      expect(getStackData(vm)).toEqual([5]);
    });

    test('handles list × list with cycling', () => {
      pushListLiteral(vm, 1, 2);
      pushListLiteral(vm, 10, 20, 30);

      binaryFlat(vm, 'add', add);

      expect(getStackData(vm)).toEqual([12, 21, 32, Tagged(3, Tag.LIST)]);
    });

    test('handles scalar × list broadcasting', () => {
      pushNumber(vm, 5);
      pushListLiteral(vm, 1, 2, 3);

      binaryFlat(vm, 'add', add);

      expect(getStackData(vm)).toEqual([6, 7, 8, Tagged(3, Tag.LIST)]);
    });

    test('handles list × scalar broadcasting', () => {
      pushListLiteral(vm, 4, 5);
      pushNumber(vm, 1);

      binaryFlat(vm, 'add', add);

      expect(getStackData(vm)).toEqual([5, 6, Tagged(2, Tag.LIST)]);
    });

    test('returns empty list when both operands are empty lists', () => {
      pushListLiteral(vm);
      pushListLiteral(vm);

      binaryFlat(vm, 'add', add);

      expect(getStackData(vm)).toEqual([Tagged(0, Tag.LIST)]);
    });

    test('scalar × empty list preserves emptiness', () => {
      pushNumber(vm, 42);
      pushListLiteral(vm);

      binaryFlat(vm, 'add', add);

      expect(getStackData(vm)).toEqual([Tagged(0, Tag.LIST)]);
    });

    test('empty list × scalar preserves emptiness', () => {
      pushListLiteral(vm);
      pushNumber(vm, 99);

      binaryFlat(vm, 'add', add);

      expect(getStackData(vm)).toEqual([Tagged(0, Tag.LIST)]);
    });
  });
});
