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
} from "./utils";
import { toTaggedValue, PrimitiveTag, HeapSubType } from "./tagged";
import { VM } from "./vm";
import { Digest } from "./digest";
import { Memory } from "./memory";

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
      return "TestString";
    }
    throw new Error("String not found");
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
      return toTaggedValue(42, PrimitiveTag.INTEGER);
    }
    if (offset === 268) {
      return toTaggedValue(99, PrimitiveTag.INTEGER);
    }
    throw new Error("readFloat error");
  }
}

// Instantiate the dummy digest.
const dummyDigest = new DummyDigest();

// Create a dummy VM object with the minimal implementation needed for formatValue.
const dummyVM: Partial<VM> = {
  digest: dummyDigest,
  memory: new DummyMemory(),
};

describe("Utility Functions", () => {
  describe("Character check functions", () => {
    test("isDigit returns true for digit characters", () => {
      expect(isDigit("0")).toBe(true);
      expect(isDigit("5")).toBe(true);
      expect(isDigit("9")).toBe(true);
    });

    test("isDigit returns false for non-digit characters", () => {
      expect(isDigit("a")).toBe(false);
      expect(isDigit(" ")).toBe(false);
      expect(isDigit("$")).toBe(false);
    });

    test("isWhitespace returns true for whitespace characters", () => {
      expect(isWhitespace(" ")).toBe(true);
      expect(isWhitespace("\t")).toBe(true);
      expect(isWhitespace("\n")).toBe(true);
    });

    test("isWhitespace returns false for non-whitespace characters", () => {
      expect(isWhitespace("a")).toBe(false);
      expect(isWhitespace("1")).toBe(false);
    });

    test("isGroupingChar returns true for grouping characters", () => {
      expect(isGroupingChar("{")).toBe(true);
      expect(isGroupingChar("}")).toBe(true);
      expect(isGroupingChar("[")).toBe(true);
      expect(isGroupingChar("]")).toBe(true);
      expect(isGroupingChar("(")).toBe(true);
      expect(isGroupingChar(")")).toBe(true);
      expect(isGroupingChar(`"`)).toBe(true);
      expect(isGroupingChar("'")).toBe(true);
      expect(isGroupingChar("`")).toBe(true);
    });

    test("isGroupingChar returns false for non-grouping characters", () => {
      expect(isGroupingChar("a")).toBe(false);
      expect(isGroupingChar("1")).toBe(false);
      expect(isGroupingChar(" ")).toBe(false);
    });
  });

  describe("Logical and conversion functions", () => {
    test("toUnsigned16 converts numbers to 16-bit", () => {
      expect(toUnsigned16(0)).toBe(0);
      expect(toUnsigned16(0xffff + 1)).toBe(0);
      expect(toUnsigned16(0x12345)).toBe(0x2345);
    });

    test("toBoolean returns true for non-zero and false for zero", () => {
      expect(toBoolean(5)).toBe(true);
      expect(toBoolean(0)).toBe(false);
    });

    test("toNumber converts boolean to number", () => {
      expect(toNumber(true)).toBe(1);
      expect(toNumber(false)).toBe(0);
    });

    test("not returns the logical negation", () => {
      expect(not(5)).toBe(0);
      expect(not(0)).toBe(1);
    });

    test("and returns correct logical and", () => {
      expect(and(5, 10)).toBe(1);
      expect(and(5, 0)).toBe(0);
    });

    test("or returns correct logical or", () => {
      expect(or(0, 0)).toBe(0);
      expect(or(0, 10)).toBe(1);
      expect(or(5, 0)).toBe(1);
    });

    test("xor returns correct logical exclusive or", () => {
      expect(xor(5, 0)).toBe(1);
      expect(xor(5, 5)).toBe(0);
      expect(xor(0, 0)).toBe(0);
    });
  });

  describe("formatValue function", () => {
    test("returns value.toString() for non-tagged values", () => {
      expect(
        formatValue(dummyVM as VM, toTaggedValue(123, PrimitiveTag.FLOAT))
      ).toBe("123");
    });

    test("formats FLOAT tagged value", () => {
      // For FLOAT, our tagging scheme uses the raw value.
      const taggedFloat = toTaggedValue(123.4, PrimitiveTag.FLOAT);
      expect(formatValue(dummyVM as VM, taggedFloat)).toBe("123.4"); // 0x12345678 in decimal
    });

    test("formats INTEGER tagged value (non-zero)", () => {
      const taggedInt = toTaggedValue(42, PrimitiveTag.INTEGER);
      expect(formatValue(dummyVM as VM, taggedInt)).toBe("42");
    });

    test("formats INTEGER tagged value representing NIL", () => {
      const taggedNil = toTaggedValue(0, PrimitiveTag.INTEGER);
      expect(formatValue(dummyVM as VM, taggedNil)).toBe("NIL");
    });

    test("formats CODE tagged value", () => {
      const taggedCode = toTaggedValue(1234, PrimitiveTag.CODE);
      expect(formatValue(dummyVM as VM, taggedCode)).toBe("CODE(1234)");
    });

    test("formats STRING tagged value successfully", () => {
      const taggedString = toTaggedValue(100, PrimitiveTag.STRING);
      expect(formatValue(dummyVM as VM, taggedString)).toBe(`"TestString"`);
    });

    test("formats STRING tagged value when digest.get throws", () => {
      const taggedString = toTaggedValue(999, PrimitiveTag.STRING);
      expect(formatValue(dummyVM as VM, taggedString)).toBe("STRING(999)");
    });

    test("formats HEAP tagged value for BLOCK subtype", () => {
      // Use an aligned address (e.g., 320, which is 5 * 64).
      const taggedHeapBlock = toTaggedValue(
        320,
        PrimitiveTag.HEAP,
        HeapSubType.BLOCK
      );
      expect(formatValue(dummyVM as VM, taggedHeapBlock)).toBe("BLOCK(320)");
    });

    test("formats HEAP tagged value for SEQ subtype", () => {
      // Use an aligned address (e.g., 384, which is 6 * 64).
      const taggedHeapSeq = toTaggedValue(
        384,
        PrimitiveTag.HEAP,
        HeapSubType.SEQ
      );
      expect(formatValue(dummyVM as VM, taggedHeapSeq)).toBe("SEQ(384)");
    });

    test("formats HEAP tagged value for VECTOR subtype", () => {
      // Use an aligned address (e.g., 256, which is 4 * 64).
      const taggedHeapVector = toTaggedValue(
        256,
        PrimitiveTag.HEAP,
        HeapSubType.VECTOR
      );
      // Based on our DummyMemory:
      // read16 at 256 + 4 = 260 returns 2,
      // readFloat at 256 + 8 = 264 returns tagged integer for 42,
      // readFloat at 256 + 12 = 268 returns tagged integer for 99.
      expect(formatValue(dummyVM as VM, taggedHeapVector)).toBe("[ 42 99 ]");
    });

    test("formats HEAP tagged value for DICT subtype", () => {
      // Use the same aligned address as VECTOR.
      const taggedHeapDict = toTaggedValue(
        256,
        PrimitiveTag.HEAP,
        HeapSubType.DICT
      );
      expect(formatValue(dummyVM as VM, taggedHeapDict)).toBe("[ 42 99 ]");
    });

    test("formats HEAP tagged value for VECTOR when memory read fails", () => {
      const faultyMemory = new DummyMemory();
      // Override read16 and readFloat to simulate failure.
      faultyMemory.read16 = (_segment: number, _offset: number): number => {
        throw new Error("read16 failed");
      };
      faultyMemory.readFloat = (_segment: number, _offset: number): number => {
        throw new Error("readFloat failed");
      };
      const faultyVM: Partial<VM> = {
        digest: dummyDigest,
        memory: faultyMemory,
      };
      // Use an aligned address (e.g., 512 is 8*64).
      const taggedHeapVector = toTaggedValue(
        512,
        PrimitiveTag.HEAP,
        HeapSubType.VECTOR
      );
      expect(formatValue(faultyVM as VM, taggedHeapVector)).toBe("VECTOR(512)");
    });
  });
});
