import { toTaggedValue, fromTaggedValue, Tag } from '../../core/tagged';
import { Op } from '../../ops/opcodes';

describe('Tag.BUILTIN functionality', () => {
  test('should create and decode BUILTIN tagged values', () => {
    // Test creating a BUILTIN tagged value for Op.Add
    const addBuiltin = toTaggedValue(Op.Add, Tag.BUILTIN);
    const decoded = fromTaggedValue(addBuiltin);

    expect(decoded.tag).toBe(Tag.BUILTIN);
    expect(decoded.value).toBe(Op.Add);
  });

  test('should handle various opcodes', () => {
    const testCases = [Op.Add, Op.Minus, Op.Multiply, Op.Dup, Op.Drop, Op.Eval];

    testCases.forEach(opcode => {
      const tagged = toTaggedValue(opcode, Tag.BUILTIN);
      const decoded = fromTaggedValue(tagged);

      expect(decoded.tag).toBe(Tag.BUILTIN);
      expect(decoded.value).toBe(opcode);
    });
  });

  test('should validate BUILTIN value ranges', () => {
    // Should work with valid opcodes (0-127)
    expect(() => toTaggedValue(0, Tag.BUILTIN)).not.toThrow();
    expect(() => toTaggedValue(127, Tag.BUILTIN)).not.toThrow();

    // Should work with larger values too (up to 65535)
    expect(() => toTaggedValue(1000, Tag.BUILTIN)).not.toThrow();
    expect(() => toTaggedValue(65535, Tag.BUILTIN)).not.toThrow();

    // Should reject negative values
    expect(() => toTaggedValue(-1, Tag.BUILTIN)).toThrow();

    // Should reject values too large for 16-bit
    expect(() => toTaggedValue(65536, Tag.BUILTIN)).toThrow();
  });
});
