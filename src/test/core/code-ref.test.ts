/**
 * @file src/test/core/code-ref.test.ts
 *
 * Tests for code reference utility functions.
 * Verifies creation, validation, and extraction of code references for the unified @symbol system.
 */

import { createBuiltinRef, createCodeRef } from '@src/core';
import {
  isBuiltinRef,
  isFuncRef,
  isExecutableRef,
  getBuiltinOpcode,
  getCodeAddress,
} from '../utils/core-test-utils';
import { toTaggedValue, fromTaggedValue, Tag } from '@src/core';
import { Op } from '../../ops/opcodes';
import { MIN_USER_OPCODE } from '@src/core';

describe('Code Reference Utilities', () => {
  describe('createBuiltinRef', () => {
    test('should create valid builtin references', () => {
      const addRef = createBuiltinRef(Op.Add);
      const { tag, value } = fromTaggedValue(addRef);

      expect(tag).toBe(Tag.BUILTIN);
      expect(value).toBe(Op.Add);
    });

    test('should handle various valid opcodes', () => {
      const testOpcodes = [0, 1, 50, 100, 127];

      testOpcodes.forEach(opcode => {
        const ref = createBuiltinRef(opcode);
        const { tag, value } = fromTaggedValue(ref);

        expect(tag).toBe(Tag.BUILTIN);
        expect(value).toBe(opcode);
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
    test('should create valid code references', () => {
      const codeRef = createCodeRef(1000);
      const { tag, value } = fromTaggedValue(codeRef);

      expect(tag).toBe(Tag.CODE);
      expect(value).toBe(1000);
    });

    test('should handle various valid addresses', () => {
      const testAddresses = [0, 1, 8192, 32767, 65535];

      testAddresses.forEach(addr => {
        const ref = createCodeRef(addr);
        const { tag, value } = fromTaggedValue(ref);

        expect(tag).toBe(Tag.CODE);
        expect(value).toBe(addr);
      });
    });

    test('should reject invalid addresses', () => {
      expect(() => createCodeRef(-1)).toThrow('Invalid bytecode address: -1');
      expect(() => createCodeRef(65536)).toThrow('Invalid bytecode address: 65536');
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
      const builtinRef = createBuiltinRef(Op.Add);
      const numberValue = 42;
      const stringRef = toTaggedValue(100, Tag.STRING);

      expect(isFuncRef(builtinRef)).toBe(false);
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
      const builtinRef = createBuiltinRef(Op.Add);
      const numberValue = 42;

      expect(() => getCodeAddress(builtinRef)).toThrow('Value is not a code reference');
      expect(() => getCodeAddress(numberValue)).toThrow('Value is not a code reference');
    });
  });

  describe('integration with evalOp', () => {
    test('should create references compatible with enhanced evalOp', () => {
      const builtinRef = createBuiltinRef(Op.Add);
      const codeRef = createCodeRef(1000);

      const { tag: builtinTag, value: builtinValue } = fromTaggedValue(builtinRef);
      const { tag: codeTag, value: codeValue } = fromTaggedValue(codeRef);

      expect(builtinTag).toBe(Tag.BUILTIN);
      expect(builtinValue).toBe(Op.Add);
      expect(codeTag).toBe(Tag.CODE);
      expect(codeValue).toBe(1000);
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
});
