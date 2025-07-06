import {
  encodeBuiltin,
  encodeFunctionIndex,
  decodeFunctionIndex,
  isBuiltinOpcode,
  MAX_BUILTINS
} from './opcode';

describe('opcode', () => {
  describe('encodeBuiltin', () => {
    it('should encode valid opcodes', () => {
      expect(encodeBuiltin(0)).toBe(0);
      expect(encodeBuiltin(127)).toBe(127);
      // Test middle range
      expect(encodeBuiltin(64)).toBe(64);
    });

    it('should throw for out of range opcodes', () => {
      // Test negative numbers
      expect(() => encodeBuiltin(-1)).toThrow('Opcode -1 out of range');
      expect(() => encodeBuiltin(-100)).toThrow('Opcode -100 out of range');
      
      // Test numbers at and beyond MAX_BUILTINS
      expect(() => encodeBuiltin(MAX_BUILTINS)).toThrow(`Opcode ${MAX_BUILTINS} out of range`);
      expect(() => encodeBuiltin(1000)).toThrow('Opcode 1000 out of range');
    });

    it('should handle non-integer values', () => {
      // The implementation doesn't validate or modify the input
      // as long as it's within the valid range
      expect(encodeBuiltin(12.5)).toBe(12.5);
      expect(encodeBuiltin(12.9)).toBe(12.9);
      // NaN is a special case that passes the range check
      expect(encodeBuiltin(NaN)).toBe(NaN);
    });

    it('should throw for non-finite numbers', () => {
      // These are out of range and should throw
      expect(() => encodeBuiltin(Infinity)).toThrow('Opcode Infinity out of range');
      expect(() => encodeBuiltin(-Infinity)).toThrow('Opcode -Infinity out of range');
    });
  });

  describe('encodeFunctionIndex', () => {
    it('should encode valid indices', () => {
      // Test min, max, and some middle values
      expect(encodeFunctionIndex(0)).toEqual([0x80, 0x00]);
      expect(encodeFunctionIndex(127)).toEqual([0xFF, 0x00]);
      expect(encodeFunctionIndex(128)).toEqual([0x80, 0x01]);
      expect(encodeFunctionIndex(255)).toEqual([0xFF, 0x01]);
      expect(encodeFunctionIndex(256)).toEqual([0x80, 0x02]);
      expect(encodeFunctionIndex(16383)).toEqual([0xFF, 0x7F]);
    });

    it('should throw for out of range indices', () => {
      // Test negative numbers
      expect(() => encodeFunctionIndex(-1)).toThrow('Function index -1 out of range');
      expect(() => encodeFunctionIndex(-100)).toThrow('Function index -100 out of range');
      
      // Test numbers at and beyond upper limit
      expect(() => encodeFunctionIndex(16384)).toThrow('Function index 16384 out of range');
      expect(() => encodeFunctionIndex(20000)).toThrow('Function index 20000 out of range');
    });

    it('should handle non-integer values', () => {
      // The implementation uses bitwise operations which will truncate decimals
      expect(encodeFunctionIndex(12.5)).toEqual([0x8C, 0x00]);
      expect(encodeFunctionIndex(12.9)).toEqual([0x8C, 0x00]);
      // NaN will be converted to 0 by bitwise operations
      expect(encodeFunctionIndex(NaN)).toEqual([0x80, 0x00]);
      // Note: Testing with Infinity would throw due to range check
    });
  });

  describe('decodeFunctionIndex', () => {
    it('should decode valid indices', () => {
      // Test various combinations
      expect(decodeFunctionIndex(0x80, 0x00)).toBe(0);        // Min value
      expect(decodeFunctionIndex(0x81, 0x00)).toBe(1);        // Single byte
      expect(decodeFunctionIndex(0xFF, 0x00)).toBe(127);      // Max single byte
      expect(decodeFunctionIndex(0x80, 0x01)).toBe(128);      // First two-byte
      expect(decodeFunctionIndex(0x81, 0x01)).toBe(129);      // Two-byte
      expect(decodeFunctionIndex(0xFF, 0x7F)).toBe(16383);    // Max value
      // 0xAB (10101011) with 0x5F (01011111) should be (0x5F << 7) | (0xAB & 0x7F)
      // = (95 << 7) | 43 = 12160 + 43 = 12203
      expect(decodeFunctionIndex(0xAB, 0x5F)).toBe(12203);    // Random value
    });

    it('should throw for invalid bytes', () => {
      // First byte missing high bit
      expect(() => decodeFunctionIndex(0x00, 0x00)).toThrow('First byte must have high bit set');
      expect(() => decodeFunctionIndex(0x7F, 0x00)).toThrow('First byte must have high bit set');
      
      // Second byte has high bit set
      expect(() => decodeFunctionIndex(0x80, 0x80)).toThrow('Second byte must have high bit clear');
      expect(() => decodeFunctionIndex(0xFF, 0xFF)).toThrow('Second byte must have high bit clear');
    });

    it('should handle edge cases', () => {
      // Test with minimum and maximum valid values
      expect(() => decodeFunctionIndex(0x80, 0x00)).not.toThrow();
      expect(() => decodeFunctionIndex(0xFF, 0x7F)).not.toThrow();
      
      // Test with non-integer values
      expect(() => decodeFunctionIndex(0.5, 0)).toThrow();
      expect(() => decodeFunctionIndex(0, 0.5)).toThrow();
      expect(() => decodeFunctionIndex(NaN, 0)).toThrow();
      expect(() => decodeFunctionIndex(0, NaN)).toThrow();
      expect(() => decodeFunctionIndex(Infinity, 0)).toThrow();
      expect(() => decodeFunctionIndex(0, Infinity)).toThrow();
    });
  });

  describe('isBuiltinOpcode', () => {
    it('should identify built-in opcodes', () => {
      // Test boundaries and some values in between
      expect(isBuiltinOpcode(0x00)).toBe(true);    // Min valid
      expect(isBuiltinOpcode(0x3F)).toBe(true);    // Middle
      expect(isBuiltinOpcode(0x7F)).toBe(true);    // Max valid
      expect(isBuiltinOpcode(0x80)).toBe(false);   // First invalid
      expect(isBuiltinOpcode(0xFF)).toBe(false);   // Max invalid
      expect(isBuiltinOpcode(0x40)).toBe(true);    // Another valid
    });

    it('should handle edge cases', () => {
      // Test with non-integer values
      // The implementation checks if (byte & 0x80) === 0
      // For numbers, this checks the sign bit
      expect(isBuiltinOpcode(0.5)).toBe(true);     // Positive number
      // NaN is considered a built-in opcode (treated as 0)
      expect(isBuiltinOpcode(NaN)).toBe(true);
      // Infinity and -Infinity are converted to 0 by bitwise operations
      // and thus are considered built-in opcodes
      expect(isBuiltinOpcode(Infinity)).toBe(true);
      expect(isBuiltinOpcode(-Infinity)).toBe(true);
      // -0 is treated as 0
      expect(isBuiltinOpcode(-0)).toBe(true);
      // Negative numbers have the sign bit set
      expect(isBuiltinOpcode(-1)).toBe(false);
    });
  });
});
