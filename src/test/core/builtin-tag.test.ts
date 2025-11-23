import { Tagged, getTaggedInfo, Tag } from '../../core';
import { Op } from '../../ops/opcodes';

describe('Tag.CODE < 128 functionality (replaces Tag.BUILTIN)', () => {
  test('should create and decode CODE tagged values for builtins', () => {
    const addBuiltin = Tagged(Op.Add, Tag.CODE);
    const decoded = getTaggedInfo(addBuiltin);

    expect(decoded.tag).toBe(Tag.CODE);
    expect(decoded.value).toBe(Op.Add); // Stored directly, not X1516 encoded
  });

  test('should handle various opcodes', () => {
    const testCases = [Op.Add, Op.Minus, Op.Multiply, Op.Dup, Op.Drop, Op.Eval];

    testCases.forEach(opcode => {
      const tagged = Tagged(opcode, Tag.CODE);
      const decoded = getTaggedInfo(tagged);

      expect(decoded.tag).toBe(Tag.CODE);
      expect(decoded.value).toBe(opcode); // Stored directly, not X1516 encoded
    });
  });

  test('should validate CODE value ranges for builtins', () => {
    // Values < 128 are stored directly (not X1516 encoded)
    expect(() => Tagged(0, Tag.CODE)).not.toThrow();
    expect(() => Tagged(127, Tag.CODE)).not.toThrow();

    // Values >= 128 are X1516 encoded (but still valid)
    expect(() => Tagged(1000, Tag.CODE)).not.toThrow();
    expect(() => Tagged(524287, Tag.CODE)).not.toThrow();

    expect(() => Tagged(-1, Tag.CODE)).toThrow();

    expect(() => Tagged(524288, Tag.CODE)).toThrow();
  });
});
