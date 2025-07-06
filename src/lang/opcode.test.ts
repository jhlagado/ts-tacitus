import {
  encodeBuiltin,
  encodeFunctionIndex,
  decodeFunctionIndex,
  isBuiltinOpcode} from './opcode';

describe('opcode', () => {
  describe('encodeBuiltin', () => {
    it('should encode valid opcodes', () => {
      expect(encodeBuiltin(0)).toBe(0);
      expect(encodeBuiltin(127)).toBe(127);
    });

    it('should throw for out of range opcodes', () => {
      expect(() => encodeBuiltin(-1)).toThrow();
      expect(() => encodeBuiltin(128)).toThrow();
    });
  });

  describe('encodeFunctionIndex', () => {
    it('should encode valid indices', () => {
      // Test min, max, and some middle values
      expect(encodeFunctionIndex(0)).toEqual([0x80, 0x00]);
      expect(encodeFunctionIndex(127)).toEqual([0xFF, 0x00]);
      expect(encodeFunctionIndex(128)).toEqual([0x80, 0x01]);
      expect(encodeFunctionIndex(16383)).toEqual([0xFF, 0x7F]);
    });

    it('should throw for out of range indices', () => {
      expect(() => encodeFunctionIndex(-1)).toThrow();
      expect(() => encodeFunctionIndex(16384)).toThrow();
    });
  });

  describe('decodeFunctionIndex', () => {
    it('should decode valid indices', () => {
      expect(decodeFunctionIndex(0x80, 0x00)).toBe(0);
      expect(decodeFunctionIndex(0xFF, 0x00)).toBe(127);
      expect(decodeFunctionIndex(0x80, 0x01)).toBe(128);
      expect(decodeFunctionIndex(0xFF, 0x7F)).toBe(16383);
    });

    it('should throw for invalid bytes', () => {
      expect(() => decodeFunctionIndex(0x00, 0x00)).toThrow(); // First byte missing high bit
      expect(() => decodeFunctionIndex(0x80, 0x80)).toThrow(); // Second byte has high bit set
    });
  });

  describe('isBuiltinOpcode', () => {
    it('should identify built-in opcodes', () => {
      expect(isBuiltinOpcode(0x00)).toBe(true);
      expect(isBuiltinOpcode(0x7F)).toBe(true);
      expect(isBuiltinOpcode(0x80)).toBe(false);
      expect(isBuiltinOpcode(0xFF)).toBe(false);
    });
  });
});
