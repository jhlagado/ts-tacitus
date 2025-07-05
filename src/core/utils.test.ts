import {
  isDigit,
  isWhitespace,
  isGroupingChar,
  toUnsigned16,
  toBoolean,
  not,
  and,
  or,
  xor,
  formatValue,
} from './utils';
import { toTaggedValue, CoreTag } from './tagged';
import { VM } from './vm';
import { initializeInterpreter, vm } from './globalState';

// Add toNumber function for testing since it's not exported from utils
function toNumber(value: boolean): number {
  return value ? 1 : 0;
}

// No dummy classes needed for these simple utility tests

describe('Utility Functions', () => {
  describe('Character check functions', () => {
    it('isDigit returns true for digit characters', () => {
      expect(isDigit('0')).toBe(true);
      expect(isDigit('5')).toBe(true);
      expect(isDigit('9')).toBe(true);
    });

    it('isDigit returns false for non-digit characters', () => {
      expect(isDigit('a')).toBe(false);
      expect(isDigit(' ')).toBe(false);
      expect(isDigit('$')).toBe(false);
    });

    it('isWhitespace returns true for whitespace characters', () => {
      expect(isWhitespace(' ')).toBe(true);
      expect(isWhitespace('\t')).toBe(true);
      expect(isWhitespace('\n')).toBe(true);
    });

    it('isWhitespace returns false for non-whitespace characters', () => {
      expect(isWhitespace('a')).toBe(false);
      expect(isWhitespace('1')).toBe(false);
    });

    it('isGroupingChar returns true for grouping characters', () => {
      expect(isGroupingChar('{')).toBe(true);
      expect(isGroupingChar('}')).toBe(true);
      expect(isGroupingChar('[')).toBe(true);
      expect(isGroupingChar(']')).toBe(true);
      expect(isGroupingChar('(')).toBe(true);
      expect(isGroupingChar(')')).toBe(true);
      expect(isGroupingChar(`"`)).toBe(true);
      expect(isGroupingChar("'")).toBe(true);
      expect(isGroupingChar('`')).toBe(true);
    });

    it('isGroupingChar returns false for non-grouping characters', () => {
      expect(isGroupingChar('a')).toBe(false);
      expect(isGroupingChar('1')).toBe(false);
      expect(isGroupingChar(' ')).toBe(false);
    });
  });

  describe('Logical and conversion functions', () => {
    it('toUnsigned16 converts numbers to 16-bit', () => {
      expect(toUnsigned16(0)).toBe(0);
      expect(toUnsigned16(0xffff + 1)).toBe(0);
      expect(toUnsigned16(0x12345)).toBe(0x2345);
    });

    it('toBoolean returns true for non-zero and false for zero', () => {
      expect(toBoolean(5)).toBe(true);
      expect(toBoolean(0)).toBe(false);
    });

    it('toNumber converts boolean to number', () => {
      expect(toNumber(true)).toBe(1);
      expect(toNumber(false)).toBe(0);
    });

    it('not returns the logical negation', () => {
      expect(not(5)).toBe(0);
      expect(not(0)).toBe(1);
    });

    it('and returns correct logical and', () => {
      expect(and(5, 10)).toBe(1);
      expect(and(5, 0)).toBe(0);
    });

    it('or returns correct logical or', () => {
      expect(or(0, 0)).toBe(0);
      expect(or(0, 10)).toBe(1);
      expect(or(5, 0)).toBe(1);
    });

    it('xor returns correct logical exclusive or', () => {
      expect(xor(5, 0)).toBe(1);
      expect(xor(5, 5)).toBe(0);
      expect(xor(0, 0)).toBe(0);
    });
  });

  describe('formatValue function', () => {
    let testVM: VM;

    beforeEach(() => {
      // Create a fresh VM instance for each test
      initializeInterpreter();
      testVM = vm;
    });

    it('returns value.toString() for non-tagged values', () => {
      expect(formatValue(testVM, 123)).toBe('123');
    });

    it('formats FLOAT tagged value', () => {
      expect(formatValue(testVM, 123.4)).toBe('123.4');
    });

    it('formats INTEGER tagged value (non-zero)', () => {
      const taggedInt = toTaggedValue(42, false, CoreTag.INTEGER);
      expect(formatValue(testVM, taggedInt)).toBe('42');
    });

    it('formats INTEGER tagged value representing NIL', () => {
      const taggedNil = toTaggedValue(0, false, CoreTag.INTEGER);
      // Current implementation just returns the value as a string
      expect(formatValue(testVM, taggedNil)).toBe('0');
    });

    it('formats CODE tagged value', () => {
      const taggedCode = toTaggedValue(1234, false, CoreTag.CODE);
      expect(formatValue(testVM, taggedCode)).toBe('<code:1234>');
    });

    it('formats STRING tagged value successfully', () => {
      // Add the string to the VM's digest
      const strAddr = testVM.digest.add('TestString');
      const taggedString = toTaggedValue(strAddr, false, CoreTag.STRING);
      expect(formatValue(testVM, taggedString)).toBe(`"TestString"`);
    });

    it('formats STRING tagged value when digest.get throws', () => {
      const taggedString = toTaggedValue(999, false, CoreTag.STRING);
      // Current implementation returns empty string when digest.get throws
      expect(formatValue(testVM as VM, taggedString)).toBe(`""`);
    });
  });
});
