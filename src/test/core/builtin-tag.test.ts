import { toTaggedValue, fromTaggedValue, Tag } from '../../core';
import { Op } from '../../ops/opcodes';

describe('Tag.CODE < 128 functionality (replaces Tag.BUILTIN)', () => {
  test('should create and decode CODE tagged values for builtins', () => {
    const addBuiltin = toTaggedValue(Op.Add, Tag.CODE);
    const decoded = fromTaggedValue(addBuiltin);

    expect(decoded.tag).toBe(Tag.CODE);
    expect(decoded.value).toBe(Op.Add); // Stored directly, not X1516 encoded
  });

  test('should handle various opcodes', () => {
    const testCases = [Op.Add, Op.Minus, Op.Multiply, Op.Dup, Op.Drop, Op.Eval];

    testCases.forEach(opcode => {
      const tagged = toTaggedValue(opcode, Tag.CODE);
      const decoded = fromTaggedValue(tagged);

      expect(decoded.tag).toBe(Tag.CODE);
      expect(decoded.value).toBe(opcode); // Stored directly, not X1516 encoded
    });
  });

  test('should validate CODE value ranges for builtins', () => {
    // Values < 128 are stored directly (not X1516 encoded)
    expect(() => toTaggedValue(0, Tag.CODE)).not.toThrow();
    expect(() => toTaggedValue(127, Tag.CODE)).not.toThrow();

    // Values >= 128 are X1516 encoded (but still valid)
    expect(() => toTaggedValue(1000, Tag.CODE)).not.toThrow();
    expect(() => toTaggedValue(65535, Tag.CODE)).not.toThrow();

    expect(() => toTaggedValue(-1, Tag.CODE)).toThrow();

    expect(() => toTaggedValue(65536, Tag.CODE)).toThrow();
  });
});
