/**
 * @file src/test/core/code-ref.test.ts
 *
 * Tests for code reference utility functions.
 * Verifies creation, validation, and extraction of code references for the unified @symbol system.
 */

import {
  createCodeRef,
  encodeX1516,
  decodeX1516,
  CODE_ALIGN_SHIFT,
  CODE_ALIGN_BYTES,
  CODE_MAX_BYTE_ADDRESS,
  MIN_USER_OPCODE,
} from '../../core';
import {
  isBuiltinRef,
  isFuncRef,
  isExecutableRef,
  getBuiltinOpcode,
  getCodeAddress,
} from '../utils/core-test-utils';
import { Tagged, getTaggedInfo, Tag } from '../../core';
import { Op } from '../../ops/opcodes';

describe('Code Reference Utilities', () => {
  describe('X1516 Encoding/Decoding', () => {
    const expectEncoded = (addr: number) => {
      const payload = addr >> CODE_ALIGN_SHIFT;
      const low = 0x80 | (payload & 0x7f);
      const high = (payload >> 7) & 0xff;
      return (high << 8) | low;
    };

    describe('encodeX1516', () => {
      test('should encode address 0 to 0x0080', () => {
        expect(encodeX1516(0)).toBe(0x0080);
      });

      test('should encode address 16384 to scaled payload', () => {
        expect(encodeX1516(16384)).toBe(expectEncoded(16384));
      });

      test('should encode address 64 to scaled payload', () => {
        expect(encodeX1516(64)).toBe(expectEncoded(64));
      });

      test('should encode address 128 to scaled payload', () => {
        expect(encodeX1516(128)).toBe(expectEncoded(128));
      });

      test('should encode address 256 to scaled payload', () => {
        expect(encodeX1516(256)).toBe(expectEncoded(256));
      });

      test('should encode max address to 0xFFFF', () => {
        expect(encodeX1516(CODE_MAX_BYTE_ADDRESS)).toBe(0xffff);
      });

      test('should reject invalid addresses', () => {
        expect(() => encodeX1516(-1)).toThrow(/Invalid address/);
        expect(() => encodeX1516(CODE_MAX_BYTE_ADDRESS + CODE_ALIGN_BYTES)).toThrow(
          /Invalid address/,
        );
        expect(() => encodeX1516(CODE_ALIGN_BYTES - 1)).toThrow(/Invalid alignment/);
      });
    });

    describe('decodeX1516', () => {
      test('should decode 0x0080 to address 0', () => {
        expect(decodeX1516(0x0080)).toBe(0);
      });

      test('should decode 0x8080 to address 16384 scaled', () => {
        expect(decodeX1516(0x8080)).toBe(16384 << CODE_ALIGN_SHIFT);
      });

      test('should decode 0x00C0/0x00?? to address 64 scaled', () => {
        expect(decodeX1516(expectEncoded(64))).toBe(64);
      });

      test('should decode 0x0180/0x01?? to address 128 scaled', () => {
        expect(decodeX1516(expectEncoded(128))).toBe(128);
      });

      test('should decode 0x0280/0x02?? to address 256 scaled', () => {
        expect(decodeX1516(expectEncoded(256))).toBe(256);
      });

      test('should decode 0xFFFF to max address scaled', () => {
        expect(decodeX1516(0xffff)).toBe(CODE_MAX_BYTE_ADDRESS);
      });

      test('should reject invalid encoded values', () => {
        expect(() => decodeX1516(0x007f)).toThrow('Invalid X1516 encoded value');
        expect(() => decodeX1516(0x10000)).toThrow('Invalid X1516 encoded value');
      });
    });

    describe('roundtrip encoding/decoding', () => {
      test('should roundtrip all valid addresses', () => {
        const testAddresses = [
          0,
          CODE_ALIGN_BYTES,
          64,
          128,
          256,
          1000 - (1000 % CODE_ALIGN_BYTES),
          8192,
          16384,
          CODE_MAX_BYTE_ADDRESS,
        ];

        testAddresses.forEach(addr => {
          const encoded = encodeX1516(addr);
          const decoded = decodeX1516(encoded);
          expect(decoded).toBe(addr);
        });
      });
    });
  });

  describe('createCodeRef', () => {
    test('should create valid code references with X1516 encoding', () => {
      const codeRef = createCodeRef(1000 - (1000 % CODE_ALIGN_BYTES));
      const { tag, value } = getTaggedInfo(codeRef);

      expect(tag).toBe(Tag.CODE);
      expect(value).toBe(encodeX1516(1000 - (1000 % CODE_ALIGN_BYTES))); // Value is X1516 encoded
      expect(getCodeAddress(codeRef)).toBe(1000 - (1000 % CODE_ALIGN_BYTES)); // But getCodeAddress decodes it
    });

    test('should handle various valid addresses with X1516 encoding (or direct for < 128)', () => {
      const testAddresses = [
        0,
        1,
        64,
        127,
        8192,
        CODE_MAX_BYTE_ADDRESS - ((CODE_MAX_BYTE_ADDRESS / CODE_ALIGN_BYTES) % 2 === 1 ? 0 : 0),
      ];

      testAddresses.forEach(addr => {
        const alignedAddr = addr < 128 ? addr : addr - (addr % CODE_ALIGN_BYTES);
        const ref = createCodeRef(addr);
        const { tag, value } = getTaggedInfo(ref);

        expect(tag).toBe(Tag.CODE);
        // For addresses < 128, value is stored directly (not X1516 encoded)
        // For addresses >= 128, value is X1516 encoded
        if (alignedAddr < 128) {
          expect(value).toBe(alignedAddr); // Stored directly
        } else {
          expect(value).toBe(encodeX1516(alignedAddr)); // X1516 encoded
        }
        expect(getCodeAddress(ref)).toBe(alignedAddr); // getCodeAddress handles both cases
      });
    });

    test('should reject invalid addresses', () => {
      expect(() => createCodeRef(-1)).toThrow('Invalid bytecode address: -1');
      expect(() => createCodeRef(CODE_MAX_BYTE_ADDRESS + CODE_ALIGN_BYTES)).toThrow(
        'Invalid bytecode address',
      );
      expect(() => createCodeRef(MIN_USER_OPCODE + 1)).toThrow('Invalid alignment');
    });
  });

  describe('isBuiltinRef', () => {
    test('should identify builtin references correctly', () => {
      const builtinRef = createCodeRef(Op.Add);

      expect(isBuiltinRef(builtinRef)).toBe(true);
    });

    test('should reject non-builtin references', () => {
      const codeRef = createCodeRef(1000);
      const numberValue = 42;
      const stringRef = Tagged(100, Tag.STRING);

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
      const numberValue = 42;
      const stringRef = Tagged(100, Tag.STRING);

      // Builtin opcodes (< 128) also use Tag.CODE references
      const builtinRef = createCodeRef(Op.Add);
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
      const builtinRef = createCodeRef(Op.Add);
      const codeRef = createCodeRef(1000);

      expect(isExecutableRef(builtinRef)).toBe(true);
      expect(isExecutableRef(codeRef)).toBe(true);
    });

    test('should reject non-executable values', () => {
      const numberValue = 42;
      const stringRef = Tagged(100, Tag.STRING);
      const listRef = Tagged(3, Tag.LIST);

      expect(isExecutableRef(numberValue)).toBe(false);
      expect(isExecutableRef(stringRef)).toBe(false);
      expect(isExecutableRef(listRef)).toBe(false);
    });
  });

  describe('getBuiltinOpcode', () => {
    test('should extract opcode from valid builtin references', () => {
      const testOpcodes = [Op.Add, Op.Dup, Op.Multiply, Op.Drop];

      testOpcodes.forEach(opcode => {
        const ref = createCodeRef(opcode);
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
      const testAddresses = [0, 1000, 8192, 32768];

      testAddresses.forEach(addr => {
        const ref = createCodeRef(addr);
        const extractedAddr = getCodeAddress(ref);

        expect(extractedAddr).toBe(addr);
      });
    });

    test('should reject non-code references', () => {
      const builtinRef = createCodeRef(Op.Add);
      const numberValue = 42;

      // Builtin refs are Tag.CODE, so getCodeAddress works on them
      expect(getCodeAddress(builtinRef)).toBe(Op.Add);
      expect(() => getCodeAddress(numberValue)).toThrow('Value is not a code reference');
    });
  });

  describe('integration with evalOp', () => {
    test('should create references compatible with enhanced evalOp', () => {
      const builtinRef = createCodeRef(Op.Add);
      const codeRef = createCodeRef(1000);

      const { tag: builtinTag, value: builtinValue } = getTaggedInfo(builtinRef);
      const { tag: codeTag, value: codeValue } = getTaggedInfo(codeRef);

      expect(builtinTag).toBe(Tag.CODE);
      expect(builtinValue).toBe(Op.Add); // Stored directly, not X1516 encoded
      expect(codeTag).toBe(Tag.CODE);
      expect(codeValue).toBe(encodeX1516(1000)); // Value is X1516 encoded
      expect(getCodeAddress(codeRef)).toBe(1000); // But getCodeAddress decodes it
    });

    test('should roundtrip through creation and extraction', () => {
      const originalOpcode = Op.Multiply;
      const originalAddr = 12344;

      const builtinRef = createCodeRef(originalOpcode);
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
      const { tag, value } = getTaggedInfo(codeRef);

      expect(tag).toBe(Tag.CODE);
      expect(value).toBe(opcode); // Stored directly, not encoded
      expect(getCodeAddress(codeRef)).toBe(opcode);
    });

    test('should store addresses >= 128 with X1516 encoding', () => {
      const addr = 1000; // >= 128
      const codeRef = createCodeRef(addr);
      const { tag, value } = getTaggedInfo(codeRef);

      expect(tag).toBe(Tag.CODE);
      expect(value).toBe(encodeX1516(addr)); // X1516 encoded
      expect(getCodeAddress(codeRef)).toBe(addr);
    });

    test('should allow direct creation of Tag.CODE with opcode < 128', () => {
      const opcode = Op.Dup; // < 128
      const codeRef = Tagged(opcode, Tag.CODE);
      const { tag, value } = getTaggedInfo(codeRef);

      expect(tag).toBe(Tag.CODE);
      expect(value).toBe(opcode); // Stored directly
      expect(getCodeAddress(codeRef)).toBe(opcode);
    });
  });
});
