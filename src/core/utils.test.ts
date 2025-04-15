import {
  isDigit,
  isWhitespace,
  isGroupingChar,
  toUnsigned16,
  toBoolean,
  toNumber,
  not,
  and,
  or,
  xor,
  formatValue,
} from './utils';
import { toTaggedValue, CoreTag, HeapTag } from './tagged';
import { VM } from './vm';
import { Digest } from './digest';
import { Memory } from './memory';
import { initializeInterpreter, vm } from './globalState';
import { vectorCreate } from '../heap/vector';

// Create a dummy subclass of Digest to satisfy the type requirements.
class DummyDigest extends Digest {
  constructor() {
    super(new Memory());
    this.SBP = 0;
  }
  add(_str: string): number {
    return 0;
  }
  reset(_addr: number = 0): void {
    // no-op
  }
  get(address: number): string {
    if (address === 100) {
      return 'TestString';
    }
    throw new Error('String not found');
  }
  length(_address: number): number {
    return 0;
  }
  find(_str: string): number {
    return -1;
  }
  intern(_str: string): number {
    return 0;
  }
  get remainingSpace(): number {
    return 2048;
  }
}

// Create a dummy Memory subclass for our VM.
class DummyMemory extends Memory {
  constructor() {
    super();
  }
  read16(_segment: number, offset: number): number {
    // For the vector/dict tests, when the base address is 256,
    // we expect read16(?, 256 + VEC_SIZE) = read16(?, 260) to return 2.
    if (offset === 260) {
      return 2;
    }
    return 0;
  }
  readFloat(_segment: number, offset: number): number {
    // For a vector starting at base 256 with VEC_DATA offset of 8:
    // first element is at 256 + 8 = 264, second at 256 + 8 + 4 = 268.
    if (offset === 264) {
      return toTaggedValue(42, false, CoreTag.INTEGER);
    }
    if (offset === 268) {
      return toTaggedValue(99, false, CoreTag.INTEGER);
    }
    throw new Error('readFloat error');
  }
}

// Instantiate the dummy digest.
const dummyDigest = new DummyDigest();

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
      expect(formatValue(testVM, taggedNil)).toBe('NIL');
    });

    it('formats CODE tagged value', () => {
      const taggedCode = toTaggedValue(1234, false, CoreTag.CODE);
      expect(formatValue(testVM, taggedCode)).toBe('CODE(1234)');
    });

    it('formats STRING tagged value successfully', () => {
      // Add the string to the VM's digest
      const strAddr = testVM.digest.add('TestString');
      const taggedString = toTaggedValue(strAddr, false, CoreTag.STRING);
      expect(formatValue(testVM, taggedString)).toBe(`"TestString"`);
    });

    it('formats HEAP tagged value for VECTOR subtype', () => {
      // Create an actual vector in the heap with values [42, 99]
      const vectorPtr = vectorCreate(testVM.heap, [42, 99]);
      expect(formatValue(testVM, vectorPtr)).toBe('[ 42 99 ]');
    });

    it('formats nested vectors correctly', () => {
      // This is a new test to verify nested vector formatting
      const innerVector = vectorCreate(testVM.heap, [3]);
      const outerVector = vectorCreate(testVM.heap, [1, 2, innerVector]);
      expect(formatValue(testVM, outerVector)).toBe('[ 1 2 [ 3 ] ]');
    });

    it('formats STRING tagged value when digest.get throws', () => {
      const taggedString = toTaggedValue(999, false, CoreTag.STRING);
      expect(formatValue(testVM as VM, taggedString)).toBe('""');
    });

    it('formats HEAP tagged value for BLOCK subtype', () => {
      // Use an aligned address (e.g., 320, which is 5 * 64).
      const taggedHeapBlock = toTaggedValue(320, true, HeapTag.BLOCK);
      expect(formatValue(testVM as VM, taggedHeapBlock)).toBe('BLOCK(320)');
    });

    it('formats HEAP tagged value for SEQ subtype', () => {
      // Use an aligned address (e.g., 384, which is 6 * 64).
      const taggedHeapSeq = toTaggedValue(384, true, HeapTag.SEQUENCE);
      expect(formatValue(testVM as VM, taggedHeapSeq)).toBe('SEQ(384)');
    });

    it('formats HEAP tagged value for VECTOR when memory read fails', () => {
      const faultyMemory = new DummyMemory();
      // Override read16 and readFloat to simulate failure.
      faultyMemory.read16 = (_segment: number, _offset: number): number => {
        throw new Error('read16 failed');
      };
      faultyMemory.readFloat = (_segment: number, _offset: number): number => {
        throw new Error('readFloat failed');
      };
      const faultyVM: Partial<VM> = {
        digest: dummyDigest,
        memory: faultyMemory,
      };
      // Use an aligned address (e.g., 512 is 8*64).
      const taggedHeapVector = toTaggedValue(512, true, HeapTag.VECTOR);
      expect(formatValue(faultyVM as VM, taggedHeapVector)).toBe('VECTOR(512)');
    });
  });
});
