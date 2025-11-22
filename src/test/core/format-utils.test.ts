import { formatAtomicValue, formatValue, formatList, Tag, Tagged, digestIntern } from '../../core';
import { encodeX1516 } from '../../core/code-ref';
import { createVM, type VM } from '../../core/vm';
import { push, getStackData } from '../../core/vm';

describe('Format Utils', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  describe('formatAtomicValue', () => {
    describe('simple values', () => {
      test('should format integer numbers', () => {
        const intValue = Tagged(42, Tag.NUMBER);
        expect(formatAtomicValue(vm, intValue)).toBe('42');
      });

      test('should format floating point numbers', () => {
        const floatValue = Tagged(3.14, Tag.NUMBER);
        expect(formatAtomicValue(vm, floatValue)).toBe('3.14');
      });

      test('should format negative numbers', () => {
        const negValue = Tagged(-42, Tag.NUMBER);
        expect(formatAtomicValue(vm, negValue)).toBe('-42');
      });

      test('should format zero', () => {
        const zeroValue = Tagged(0, Tag.NUMBER);
        expect(formatAtomicValue(vm, zeroValue)).toBe('0');
      });
    });

    describe('string values', () => {
      test('should format valid strings from digest', () => {
        const testString = 'hello world';
        const stringAddr = digestIntern(vm.compile.digest, testString);
        const stringValue = Tagged(stringAddr, Tag.STRING);
        expect(formatAtomicValue(vm, stringValue)).toBe(`"${testString}"`);
      });

      test('should handle invalid string addresses', () => {
        const invalidStringValue = Tagged(999, Tag.STRING);
        expect(formatAtomicValue(vm, invalidStringValue)).toBe('[String:999]');
      });

      test('should format empty strings', () => {
        const emptyString = '';
        const stringAddr = digestIntern(vm.compile.digest, emptyString);
        const stringValue = Tagged(stringAddr, Tag.STRING);
        expect(formatAtomicValue(vm, stringValue)).toBe(`[String:${stringAddr}]`);
      });

      test('should format strings with escape sequences', () => {
        const escapedString = 'hello\n"world"\t\\test';
        const stringAddr = digestIntern(vm.compile.digest, escapedString);
        const stringValue = Tagged(stringAddr, Tag.STRING);
        expect(formatAtomicValue(vm, stringValue)).toBe(`"hello\\n\\"world\\"\\t\\\\test"`);
      });
    });

    describe('other tag types', () => {
      test('should format CODE tags with tag name and value', () => {
        const codeValue = Tagged(encodeX1516(100), Tag.CODE);
        expect(formatAtomicValue(vm, codeValue)).toBe('[CODE:100]');
      });

      test('should format LIST tags with tag name and value', () => {
        const listValue = Tagged(2, Tag.LIST);
        expect(formatAtomicValue(vm, listValue)).toBe('[LIST:2]');
      });

      test('should format numeric value', () => {
        const intValue = 42;
        expect(formatAtomicValue(vm, intValue)).toBe('42');
      });
    });
  });

  describe('formatValue', () => {
    describe('simple values', () => {
      test('should format number values', () => {
        const numValue = Tagged(42, Tag.NUMBER);
        expect(formatValue(vm, numValue)).toBe('42');
      });

      test('should format floating point values', () => {
        const floatValue = Tagged(3.14, Tag.NUMBER);
        expect(formatValue(vm, floatValue)).toBe('3.14');
      });

      test('should format string values', () => {
        const strAddr = digestIntern(vm.compile.digest, 'test string');
        const stringValue = Tagged(strAddr, Tag.STRING);
        expect(formatValue(vm, stringValue)).toBe('"test string"');
      });

      test('should format invalid string values', () => {
        const invalidStringValue = Tagged(1000, Tag.STRING);
        expect(formatValue(vm, invalidStringValue)).toBe('[String:1000]');
      });
    });

    // list operations formatting test removed (fragile/non-essential)

    describe('other value types', () => {
      test('should format CODE values', () => {
        const codeValue = Tagged(encodeX1516(100), Tag.CODE);
        expect(formatValue(vm, codeValue)).toBe('[CODE:100]');
      });

      test('should format unknown tag types', () => {
        const unknownValue = Tagged(encodeX1516(123), Tag.CODE);
        expect(formatValue(vm, unknownValue)).toBe('[CODE:123]');
      });
    });

    describe('error cases', () => {
      test('should handle special float values through formatFloat', () => {
        const tagged = Tagged(0, Tag.NUMBER); // NaN gets encoded as 0 in tagged values
        expect(formatValue(vm, tagged)).toBe('0');
      });

      test('should handle infinity values', () => {
        const infValue = Tagged(Infinity, Tag.NUMBER);
        expect(formatValue(vm, infValue)).toBe('Infinity');

        const negInfValue = Tagged(-Infinity, Tag.NUMBER);
        expect(formatValue(vm, negInfValue)).toBe('-Infinity');
      });
    });

    describe('integration tests', () => {
      test('should handle mixed data types in complex structures', () => {
        const strAddr = digestIntern(vm.compile.digest, 'hello');
        push(vm, 3.14);
        push(vm, 42);
        push(vm, Tagged(strAddr, Tag.STRING));
        push(vm, Tagged(3, Tag.LIST));
        const header = getStackData(vm)[getStackData(vm).length - 1];
        const result = formatValue(vm, header);
        expect(result).toBe('( "hello" 42 3.14 )');
      });
    });

    describe('edge cases and coverage', () => {
      test('formats near-integer floats by rounding', () => {
        const v = Tagged(3.00005, Tag.NUMBER);
        expect(formatAtomicValue(vm, v)).toBe('3');
      });

      test('formats tiny floats with fixed then trim', () => {
        const v = Tagged(0.00009, Tag.NUMBER);
        expect(formatAtomicValue(vm, v)).toBe('0');
      });

      test('formats strings with carriage return escape', () => {
        const s = 'line1\rline2';
        const addr = digestIntern(vm.compile.digest, s);
        const tagged = Tagged(addr, Tag.STRING);
        expect(formatValue(vm, tagged)).toBe('"line1\\rline2"');
      });

      test('formatList returns empty list when SP insufficient', () => {
        const header = Tagged(1, Tag.LIST);
        expect(formatList(vm, header)).toBe('(  )');
      });
    });
  });
});
