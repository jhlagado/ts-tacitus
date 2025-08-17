import { formatAtomicValue, formatValue } from '../../core/format-utils';
import { initializeInterpreter, vm } from '../../core/globalState';
import { Tag, toTaggedValue } from '../../core/tagged';
import { executeTacitCode } from '../utils/vm-test-utils';

describe('Format Utils', () => {
  beforeEach(() => {
    initializeInterpreter();
  });


  describe('formatAtomicValue', () => {
    describe('simple values', () => {
      test('should format integer numbers', () => {
        const intValue = toTaggedValue(42, Tag.NUMBER);
        expect(formatAtomicValue(vm, intValue)).toBe('42');
      });

      test('should format floating point numbers', () => {
        const floatValue = toTaggedValue(3.14, Tag.NUMBER);
        expect(formatAtomicValue(vm, floatValue)).toBe('3.14');
      });

      test('should format negative numbers', () => {
        const negValue = toTaggedValue(-42, Tag.NUMBER);
        expect(formatAtomicValue(vm, negValue)).toBe('-42');
      });

      test('should format zero', () => {
        const zeroValue = toTaggedValue(0, Tag.NUMBER);
        expect(formatAtomicValue(vm, zeroValue)).toBe('0');
      });
    });

    describe('string values', () => {
      test('should format valid strings from digest', () => {
        const testString = 'hello world';
        const stringAddr = vm.digest.intern(testString);
        const stringValue = toTaggedValue(stringAddr, Tag.STRING);
        expect(formatAtomicValue(vm, stringValue)).toBe(testString);
      });

      test('should handle invalid string addresses', () => {
        const invalidStringValue = toTaggedValue(999, Tag.STRING);
        expect(formatAtomicValue(vm, invalidStringValue)).toBe('[String:999]');
      });

      test('should format empty strings', () => {
        const emptyString = '';
        const stringAddr = vm.digest.intern(emptyString);
        const stringValue = toTaggedValue(stringAddr, Tag.STRING);
        expect(formatAtomicValue(vm, stringValue)).toBe(`[String:${stringAddr}]`); 
      });
    });

    describe('other tag types', () => {
      test('should format CODE tags with tag name and value', () => {
        const codeValue = toTaggedValue(100, Tag.CODE);
        expect(formatAtomicValue(vm, codeValue)).toBe('[CODE:100]');
      });

      test('should format LIST tags with tag name and value', () => {
        const listValue = toTaggedValue(2, Tag.LIST);
        expect(formatAtomicValue(vm, listValue)).toBe('[LIST:2]');
      });

      test('should format SENTINEL tags with tag name and value', () => {
        const intValue = toTaggedValue(42, Tag.SENTINEL);
        expect(formatAtomicValue(vm, intValue)).toBe('[SENTINEL:42]');
      });
    });
  });


  describe('formatValue', () => {
    describe('simple values', () => {
      test('should format number values', () => {
        const numValue = toTaggedValue(42, Tag.NUMBER);
        expect(formatValue(vm, numValue)).toBe('42');
      });

      test('should format floating point values', () => {
        const floatValue = toTaggedValue(3.14, Tag.NUMBER);
        expect(formatValue(vm, floatValue)).toBe('3.14');
      });

      test('should format string values', () => {
        const strAddr = vm.digest.intern('test string');
        const stringValue = toTaggedValue(strAddr, Tag.STRING);
        expect(formatValue(vm, stringValue)).toBe(`( ${strAddr} elements )`);
      });

      test('should format invalid string values', () => {
        const invalidStringValue = toTaggedValue(1000, Tag.STRING);
        expect(formatValue(vm, invalidStringValue)).toBe('( 1000 elements )');
      });
    });

    describe('list operations', () => {
      test('should format LIST values', () => {
        const stack = executeTacitCode('( 1 2 3 )');
        const header = stack[stack.length - 1];
        const result = formatValue(vm, header);
        expect(result).toBe('( 1 2 3 )');
      });
    });

    describe('other value types', () => {
      test('should format CODE values', () => {
        const codeValue = toTaggedValue(100, Tag.CODE);
        expect(formatValue(vm, codeValue)).toBe('( 100 elements )'); 
      });

      test('should format SENTINEL values', () => {
        const intValue = toTaggedValue(42, Tag.SENTINEL);
        expect(formatValue(vm, intValue)).toBe('( 42 elements )'); 
      });

      test('should format unknown tag types', () => {
        const unknownValue = toTaggedValue(123, Tag.CODE);
        expect(formatValue(vm, unknownValue)).toBe('( 123 elements )'); 
      });
    });

    describe('error cases', () => {
      test('should handle special float values through formatFloat', () => {
        const nanValue = toTaggedValue(NaN, Tag.NUMBER);
        expect(formatValue(vm, nanValue)).toBe('( 0 elements )'); 
      });

      test('should handle infinity values', () => {
        const infValue = toTaggedValue(Infinity, Tag.NUMBER);
        expect(formatValue(vm, infValue)).toBe('Infinity');

        const negInfValue = toTaggedValue(-Infinity, Tag.NUMBER);
        expect(formatValue(vm, negInfValue)).toBe('-Infinity');
      });

    });

    describe('integration tests', () => {
      test('should handle mixed data types in complex structures', () => {
        const strAddr = vm.digest.intern('hello');
        vm.push(3.14);
        vm.push(42);
        vm.push(toTaggedValue(strAddr, Tag.STRING));
        vm.push(toTaggedValue(3, Tag.LIST));
        const header = vm.getStackData()[vm.getStackData().length - 1];
        const result = formatValue(vm, header);
        expect(result).toBe('( hello 42 3.14 )');
      });

      test('should handle empty containers gracefully', () => {
        const stack = executeTacitCode('( )');
        const header = stack[stack.length - 1];
        expect(formatValue(vm, header)).toBe('(  )');
      });
    });
  });
});
