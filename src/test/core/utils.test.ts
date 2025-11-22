import {
  isDigit,
  isWhitespace,
  isGroupingChar,
  formatValue,
  createVM,
  digestAdd,
} from '../../core';
import { encodeX1516 } from '../../core/code-ref';
import { Tagged, Tag, NIL, VM } from '../../core';

const testVM = createVM() as VM;
describe('Utility Functions', () => {
  describe('Character check functions', () => {
    test('isDigit returns true for digit characters', () => {
      expect(isDigit('0')).toBe(true);
      expect(isDigit('5')).toBe(true);
      expect(isDigit('9')).toBe(true);
    });
    test('isDigit returns false for non-digit characters', () => {
      expect(isDigit('a')).toBe(false);
      expect(isDigit(' ')).toBe(false);
      expect(isDigit('$')).toBe(false);
    });
    test('isWhitespace returns true for whitespace characters', () => {
      expect(isWhitespace(' ')).toBe(true);
      expect(isWhitespace('\t')).toBe(true);
      expect(isWhitespace('\n')).toBe(true);
    });
    test('isWhitespace returns false for non-whitespace characters', () => {
      expect(isWhitespace('a')).toBe(false);
      expect(isWhitespace('1')).toBe(false);
    });
    test('isGroupingChar returns true for grouping characters', () => {
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
    test('isGroupingChar returns false for non-grouping characters', () => {
      expect(isGroupingChar('a')).toBe(false);
      expect(isGroupingChar('1')).toBe(false);
      expect(isGroupingChar(' ')).toBe(false);
    });
  });
  describe('formatValue function', () => {
    test('returns value.toString() for non-tagged values', () => {
      expect(formatValue(testVM, 123)).toBe('123');
    });
    test('formats FLOAT tagged value', () => {
      expect(formatValue(testVM, 123.4)).toBe('123.4');
    });
    test('formats INTEGER tagged value (non-zero)', () => {
      const taggedInt = 42;
      expect(formatValue(testVM, taggedInt)).toBe('42');
    });
    test('formats INTEGER tagged value representing NIL', () => {
      expect(formatValue(testVM, NIL)).toBe('[SENTINEL:0]');
    });
    test('formats CODE tagged value', () => {
      const taggedCode = Tagged(encodeX1516(1234), Tag.CODE);
      // formatValue decodes X1516 to show the actual bytecode address
      expect(formatValue(testVM, taggedCode)).toBe('[CODE:1234]');
    });
    test('formats STRING tagged value successfully', () => {
      const strAddr = digestAdd(testVM.compile.digest, 'TestString');
      const taggedString = Tagged(strAddr, Tag.STRING);
      expect(formatValue(testVM, taggedString)).toBe('"TestString"');
    });
    test('formats STRING tagged value when digest.get throws', () => {
      const taggedString = Tagged(999, Tag.STRING);
      expect(formatValue(testVM as VM, taggedString)).toBe('[String:999]');
    });
  });
});
