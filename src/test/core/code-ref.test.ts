/**
 * @file src/test/core/code-ref.test.ts
 *
 * Tests for code reference utility functions.
 * Verifies creation, validation, and extraction of code references for the unified @symbol system.
 */

import { createBuiltinRef, createCodeRef, encodeX1516, decodeX1516 } from '../../core';
import {
  isBuiltinRef,
  isFuncRef,
  isExecutableRef,
  getBuiltinOpcode,
  getCodeAddress,
} from '../utils/core-test-utils';
import { toTaggedValue, fromTaggedValue, Tag } from '../../core';
import { Op } from '../../ops/opcodes';
import { MIN_USER_OPCODE } from '../../core';

describe('Code Reference Utilities', () => {
  describe('X1516 Encoding/Decoding', () => {
    describe('encodeX1516', () => {
      test('should encode address 0 to 0x0080', () => {
        expect(encodeX1516(0)).toBe(0x0080);
      });

      test('should encode address 16384 to 0x8080', () => {
        expect(encodeX1516(16384)).toBe(0x8080);
      });

      test('should encode address 64 to 0x00C0', () => {
        expect(encodeX1516(64)).toBe(0x00c0);
      });

      test('should encode address 128 to 0x0180', () => {
        expect(encodeX1516(128)).toBe(0x0180);
      });

      test('should encode address 256 to 0x0280', () => {
        expect(encodeX1516(256)).toBe(0x0280);
      });

      test('should encode address 32767 to 0xFFFF', () => {
        expect(encodeX1516(32767)).toBe(0xffff);
      });

      test('should reject invalid addresses', () => {
        expect(() => encodeX1516(-1)).toThrow('Invalid address: -1');
        expect(() => encodeX1516(32768)).toThrow('Invalid address: 32768');
      });
    });

    describe('decodeX1516', () => {
      test('should decode 0x0080 to address 0', () => {
        expect(decodeX1516(0x0080)).toBe(0);
      });

      test('should decode 0x8080 to address 16384', () => {
        expect(decodeX1516(0x8080)).toBe(16384);
      });

      test('should decode 0x00C0 to address 64', () => {
        expect(decodeX1516(0x00c0)).toBe(64);
      });

      test('should decode 0x0180 to address 128', () => {
        expect(decodeX1516(0x0180)).toBe(128);
      });

      test('should decode 0x0280 to address 256', () => {
        expect(decodeX1516(0x0280)).toBe(256);
      });

      test('should decode 0xFFFF to address 32767', () => {
        expect(decodeX1516(0xffff)).toBe(32767);
      });

      test('should reject invalid encoded values', () => {
        expect(() => decodeX1516(0x007f)).toThrow('Invalid X1516 encoded value');
        expect(() => decodeX1516(0x10000)).toThrow('Invalid X1516 encoded value');
      });
    });

    describe('roundtrip encoding/decoding', () => {
      test('should roundtrip all valid addresses', () => {
        const testAddresses = [0, 1, 64, 128, 256, 1000, 8192, 16384, 32767];

        testAddresses.forEach(addr => {
          const encoded = encodeX1516(addr);
          const decoded = decodeX1516(encoded);
          expect(decoded).toBe(addr);
        });
      });
    });
  });

  describe('createBuiltinRef', () => {
    test('should create valid builtin references (now returns Tag.CODE)', () => {
      const addRef = createBuiltinRef(Op.Add);
      const { tag, value } = fromTaggedValue(addRef);

      // createBuiltinRef now returns Tag.CODE instead of Tag.BUILTIN for unified dispatch
      expect(tag).toBe(Tag.CODE);
      expect(value).toBe(Op.Add); // Stored directly, not X1516 encoded
    });

    test('should handle various valid opcodes (now returns Tag.CODE)', () => {
      const testOpcodes = [0, 1, 50, 100, 127];

      testOpcodes.forEach(opcode => {
        const ref = createBuiltinRef(opcode);
        const { tag, value } = fromTaggedValue(ref);

        // createBuiltinRef now returns Tag.CODE instead of Tag.BUILTIN
        expect(tag).toBe(Tag.CODE);
        expect(value).toBe(opcode); // Stored directly, not X1516 encoded
      });
    });

    test('should reject invalid opcodes', () => {
      expect(() => createBuiltinRef(-1)).toThrow('Invalid builtin opcode: -1');
      expect(() => createBuiltinRef(MIN_USER_OPCODE)).toThrow(
        `Invalid builtin opcode: ${MIN_USER_OPCODE}`,
      );
      expect(() => createBuiltinRef(1000)).toThrow('Invalid builtin opcode: 1000');
    });
  });

  describe('createCodeRef', () => {
    test('should create valid code references with X1516 encoding', () => {
      const codeRef = createCodeRef(1000);
      const { tag, value } = fromTaggedValue(codeRef);

      expect(tag).toBe(Tag.CODE);
      expect(value).toBe(encodeX1516(1000)); // Value is X1516 encoded
      expect(getCodeAddress(codeRef)).toBe(1000); // But getCodeAddress decodes it
    });

    test('should handle various valid addresses with X1516 encoding (or direct for < 128)', () => {
      const testAddresses = [0, 1, 8192, 32767];

      testAddresses.forEach(addr => {
        const ref = createCodeRef(addr);
        const { tag, value } = fromTaggedValue(ref);

        expect(tag).toBe(Tag.CODE);
        // For addresses < 128, value is stored directly (not X1516 encoded)
        // For addresses >= 128, value is X1516 encoded
        if (addr < 128) {
          expect(value).toBe(addr); // Stored directly
        } else {
          expect(value).toBe(encodeX1516(addr)); // X1516 encoded
        }
        expect(getCodeAddress(ref)).toBe(addr); // getCodeAddress handles both cases
      });
    });

    test('should reject invalid addresses', () => {
      expect(() => createCodeRef(-1)).toThrow('Invalid bytecode address: -1');
      expect(() => createCodeRef(32768)).toThrow('Invalid bytecode address: 32768');
      expect(() => createCodeRef(100000)).toThrow('Invalid bytecode address: 100000');
    });
  });

  describe('isBuiltinRef', () => {
    test('should identify builtin references correctly', () => {
      const builtinRef = createBuiltinRef(Op.Add);

      expect(isBuiltinRef(builtinRef)).toBe(true);
    });

    test('should reject non-builtin references', () => {
      const codeRef = createCodeRef(1000);
      const numberValue = 42;
      const stringRef = toTaggedValue(100, Tag.STRING);

      expect(isBuiltinRef(codeRef)).toBe(false);
      expect(isBuiltinRef(numberValue)).toBe(false);
      expect(isBuiltinRef(stringRef)).toBe(false);
    });

    test('should handle malformed values gracefully', () => {
      expect(isBuiltinRef(NaN)).toBe(false);
      expect(isBuiltinRef(Infinity)).toBe(false);
      expect(isBuiltinRef(-Infinity)).toBe(false);
    });
  });

  describe('isFuncRef', () => {
    test('should identify code references correctly', () => {
      const codeRef = createCodeRef(1000);

      expect(isFuncRef(codeRef)).toBe(true);
    });

    test('should reject non-code references', () => {
      // createBuiltinRef now returns Tag.CODE, so it IS a code reference
      const numberValue = 42;
      const stringRef = toTaggedValue(100, Tag.STRING);

      // Builtin refs are now Tag.CODE, so they are code references
      const builtinRef = createBuiltinRef(Op.Add);
      expect(isFuncRef(builtinRef)).toBe(true);
      
      expect(isFuncRef(numberValue)).toBe(false);
      expect(isFuncRef(stringRef)).toBe(false);
    });

    test('should handle malformed values gracefully', () => {
      expect(isFuncRef(NaN)).toBe(false);
      expect(isFuncRef(Infinity)).toBe(false);
      expect(isFuncRef(-Infinity)).toBe(false);
    });
  });

  describe('isExecutableRef', () => {
    test('should identify all executable references', () => {
      const builtinRef = createBuiltinRef(Op.Add);
      const codeRef = createCodeRef(1000);

      expect(isExecutableRef(builtinRef)).toBe(true);
      expect(isExecutableRef(codeRef)).toBe(true);
    });

    test('should reject non-executable values', () => {
      const numberValue = 42;
      const stringRef = toTaggedValue(100, Tag.STRING);
      const listRef = toTaggedValue(3, Tag.LIST);

      expect(isExecutableRef(numberValue)).toBe(false);
      expect(isExecutableRef(stringRef)).toBe(false);
      expect(isExecutableRef(listRef)).toBe(false);
    });
  });

  describe('getBuiltinOpcode', () => {
    test('should extract opcode from valid builtin references', () => {
      const testOpcodes = [Op.Add, Op.Dup, Op.Multiply, Op.Drop];

      testOpcodes.forEach(opcode => {
        const ref = createBuiltinRef(opcode);
        const extractedOpcode = getBuiltinOpcode(ref);

        expect(extractedOpcode).toBe(opcode);
      });
    });

    test('should reject non-builtin references', () => {
      const codeRef = createCodeRef(1000);
      const numberValue = 42;

      expect(() => getBuiltinOpcode(codeRef)).toThrow('Value is not a built-in reference');
      expect(() => getBuiltinOpcode(numberValue)).toThrow('Value is not a built-in reference');
    });
  });

  describe('getCodeAddress', () => {
    test('should extract address from valid code references', () => {
      const testAddresses = [0, 1000, 8192, 32767];

      testAddresses.forEach(addr => {
        const ref = createCodeRef(addr);
        const extractedAddr = getCodeAddress(ref);

        expect(extractedAddr).toBe(addr);
      });
    });

    test('should reject non-code references', () => {
      // createBuiltinRef now returns Tag.CODE, so it IS a code reference
      const builtinRef = createBuiltinRef(Op.Add);
      const numberValue = 42;

      // Builtin refs are now Tag.CODE, so getCodeAddress works on them
      expect(getCodeAddress(builtinRef)).toBe(Op.Add);
      expect(() => getCodeAddress(numberValue)).toThrow('Value is not a code reference');
    });
  });

  describe('integration with evalOp', () => {
    test('should create references compatible with enhanced evalOp', () => {
      const builtinRef = createBuiltinRef(Op.Add);
      const codeRef = createCodeRef(1000);

      const { tag: builtinTag, value: builtinValue } = fromTaggedValue(builtinRef);
      const { tag: codeTag, value: codeValue } = fromTaggedValue(codeRef);

      // createBuiltinRef now returns Tag.CODE instead of Tag.BUILTIN
      expect(builtinTag).toBe(Tag.CODE);
      expect(builtinValue).toBe(Op.Add); // Stored directly, not X1516 encoded
      expect(codeTag).toBe(Tag.CODE);
      expect(codeValue).toBe(encodeX1516(1000)); // Value is X1516 encoded
      expect(getCodeAddress(codeRef)).toBe(1000); // But getCodeAddress decodes it
    });

    test('should roundtrip through creation and extraction', () => {
      const originalOpcode = Op.Multiply;
      const originalAddr = 12345;

      const builtinRef = createBuiltinRef(originalOpcode);
      const codeRef = createCodeRef(originalAddr);

      const extractedOpcode = getBuiltinOpcode(builtinRef);
      const extractedAddr = getCodeAddress(codeRef);

      expect(extractedOpcode).toBe(originalOpcode);
      expect(extractedAddr).toBe(originalAddr);
    });
  });

  describe('Tag.CODE < 128 as builtin opcodes', () => {
    test('should store addresses < 128 directly (not X1516 encoded)', () => {
      const opcode = Op.Add; // < 128
      const codeRef = createCodeRef(opcode);
      const { tag, value } = fromTaggedValue(codeRef);

      expect(tag).toBe(Tag.CODE);
      expect(value).toBe(opcode); // Stored directly, not encoded
      expect(getCodeAddress(codeRef)).toBe(opcode);
    });

    test('should store addresses >= 128 with X1516 encoding', () => {
      const addr = 1000; // >= 128
      const codeRef = createCodeRef(addr);
      const { tag, value } = fromTaggedValue(codeRef);

      expect(tag).toBe(Tag.CODE);
      expect(value).toBe(encodeX1516(addr)); // X1516 encoded
      expect(getCodeAddress(codeRef)).toBe(addr);
    });

    test('should allow direct creation of Tag.CODE with opcode < 128', () => {
      const opcode = Op.Dup; // < 128
      const codeRef = toTaggedValue(opcode, Tag.CODE);
      const { tag, value } = fromTaggedValue(codeRef);

      expect(tag).toBe(Tag.CODE);
      expect(value).toBe(opcode); // Stored directly
      expect(getCodeAddress(codeRef)).toBe(opcode);
    });
  });
});
