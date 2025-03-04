import {
  PrimitiveTag,
  HeapSubType,
  NIL,
  toTaggedValue,
  fromTaggedValue,
  isTaggedValue,
  getTag,
  getValue,
  isRefCounted,
  printNum,
} from "./tagged";

describe("Tagged.ts Library", () => {
  describe("Primitive Encoding and Decoding", () => {
    it("should encode and decode a FLOAT correctly", () => {
      // For FLOAT, we assume the value is already a 31-bit encoded number.
      const floatValue = 0x12345678; // our sample encoded float
      const tagged = toTaggedValue(floatValue, PrimitiveTag.FLOAT);
      const decoded = fromTaggedValue(tagged);
      expect(decoded.tag).toBe(PrimitiveTag.FLOAT);
      expect(decoded.value).toBe(floatValue);
    });

    it("should encode and decode a CODE pointer correctly", () => {
      // Choose a 29-bit address value.
      const address = 0x1fffffff;
      const tagged = toTaggedValue(address, PrimitiveTag.CODE);
      const decoded = fromTaggedValue(tagged);
      expect(decoded.tag).toBe(PrimitiveTag.CODE);
      expect(decoded.value).toBe(address);
    });

    it("should encode and decode a STRING pointer correctly", () => {
      const address = 0x10000000;
      const tagged = toTaggedValue(address, PrimitiveTag.STRING);
      const decoded = fromTaggedValue(tagged);
      expect(decoded.tag).toBe(PrimitiveTag.STRING);
      expect(decoded.value).toBe(address);
    });

    it("should encode and decode an INTEGER correctly", () => {
      const intValue = -12345;
      const tagged = toTaggedValue(intValue, PrimitiveTag.INTEGER);
      const decoded = fromTaggedValue(tagged);
      expect(decoded.tag).toBe(PrimitiveTag.INTEGER);
      expect(decoded.value).toBe(intValue);
    });

    it("should throw an error for INTEGER values out of range", () => {
      // For a 29-bit signed integer, the range is limited.
      expect(() => toTaggedValue(1 << 29, PrimitiveTag.INTEGER)).toThrow();
      expect(() =>
        toTaggedValue(-(1 << 29) - 1, PrimitiveTag.INTEGER)
      ).toThrow();
    });

    it("should encode and decode a HEAP pointer for BLOCK subtype correctly", () => {
      // Use a 64-byte aligned address (e.g. 0x100 is divisible by 64).
      const alignedAddress = 0x100;
      const tagged = toTaggedValue(
        alignedAddress,
        PrimitiveTag.HEAP,
        HeapSubType.BLOCK
      );
      const decoded = fromTaggedValue(tagged);
      expect(decoded.tag).toBe(PrimitiveTag.HEAP);
      expect(decoded.heapSubtype).toBe(HeapSubType.BLOCK);
      expect(decoded.value).toBe(alignedAddress);
    });

    it("should encode and decode a HEAP pointer for VECTOR subtype correctly", () => {
      const alignedAddress = 0x200;
      const tagged = toTaggedValue(
        alignedAddress,
        PrimitiveTag.HEAP,
        HeapSubType.VECTOR
      );
      const decoded = fromTaggedValue(tagged);
      expect(decoded.tag).toBe(PrimitiveTag.HEAP);
      expect(decoded.heapSubtype).toBe(HeapSubType.VECTOR);
      expect(decoded.value).toBe(alignedAddress);
    });

    it("should throw an error when a HEAP pointer is not 64-byte aligned", () => {
      // Address 0x105 is not 64-byte aligned.
      expect(() =>
        toTaggedValue(0x105, PrimitiveTag.HEAP, HeapSubType.SEQ)
      ).toThrow();
    });

    it("should throw an error when HEAP tag is provided without a heap subtype", () => {
      expect(() => toTaggedValue(0x100, PrimitiveTag.HEAP)).toThrow();
    });
  });

  describe("Utility Functions", () => {
    it("getTag should return the correct tag", () => {
      const intValue = 42;
      const tagged = toTaggedValue(intValue, PrimitiveTag.INTEGER);
      expect(getTag(tagged)).toBe(PrimitiveTag.INTEGER);
    });

    it("getValue should return the correct value", () => {
      const intValue = 42;
      const tagged = toTaggedValue(intValue, PrimitiveTag.INTEGER);
      expect(getValue(tagged)).toBe(intValue);
    });

    it("isRefCounted should return true only for HEAP BLOCK subtype", () => {
      const heapBlock = toTaggedValue(
        0x100,
        PrimitiveTag.HEAP,
        HeapSubType.BLOCK
      );
      const heapVector = toTaggedValue(
        0x100,
        PrimitiveTag.HEAP,
        HeapSubType.VECTOR
      );
      expect(isRefCounted(heapBlock)).toBe(true);
      expect(isRefCounted(heapVector)).toBe(false);
    });


    it("isNIL should return false for non-NIL values", () => {
      const intTagged = toTaggedValue(1, PrimitiveTag.INTEGER);
      expect(intTagged).not.toBe(NIL);
    });

    it("printNum should output correct string for INTEGER values", () => {
      const spy = jest.spyOn(console, "log").mockImplementation(() => {});
      const intTagged = toTaggedValue(123, PrimitiveTag.INTEGER);
      printNum(intTagged);
      expect(spy).toHaveBeenCalled();
      const logOutput = spy.mock.calls[0][0];
      expect(logOutput).toContain(`PrimitiveTag: ${PrimitiveTag.INTEGER}`);
      expect(logOutput).toContain(`Value: 123`);
      spy.mockRestore();
    });

    it("printNum should output correct string for HEAP types", () => {
      const spy = jest.spyOn(console, "log").mockImplementation(() => {});
      const heapTagged = toTaggedValue(
        0x200,
        PrimitiveTag.HEAP,
        HeapSubType.DICT
      );
      printNum(heapTagged);
      expect(spy).toHaveBeenCalled();
      const logOutput = spy.mock.calls[0][0];
      expect(logOutput).toContain(`PrimitiveTag: ${PrimitiveTag.HEAP}`);
      expect(logOutput).toContain(`subtype: ${HeapSubType.DICT}`);
      spy.mockRestore();
    });
  });

  describe("isTaggedValue", () => {
    it("should return true for values created by toTaggedValue", () => {
      const intTagged = toTaggedValue(5, PrimitiveTag.INTEGER);
      expect(isTaggedValue(intTagged)).toBe(true);
    });
    it("should return false for non-integer values", () => {
      expect(isTaggedValue(3.14)).toBe(false);
    });
  });
});
