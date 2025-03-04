import { Digest } from "./digest";
import { Memory, STRING_SIZE } from "./memory";

describe("Digest", () => {
  let memory: Memory;
  let digest: Digest;

  beforeEach(() => {
    memory = new Memory();
    digest = new Digest(memory);
  });

  it("should add a string, retrieve it, and report its length", () => {
    const address = digest.add("hello");
    expect(address).toBe(0);
    expect(digest.get(address)).toBe("hello");
    expect(digest.length(address)).toBe(5);
  });

  it("should correctly handle an empty string", () => {
    const address = digest.add("");
    expect(digest.get(address)).toBe("");
    expect(digest.length(address)).toBe(0);
  });

  it("should correctly handle strings with special characters", () => {
    const specialString = "hello\nworld\t!";
    const address = digest.add(specialString);
    expect(digest.get(address)).toBe(specialString);
  });

  it("should correctly handle a string with maximum length", () => {
    const maxLengthString = "a".repeat(255);
    const address = digest.add(maxLengthString);
    expect(digest.get(address)).toBe(maxLengthString);
    expect(digest.length(address)).toBe(255);
  });

  it("should throw an error if the string is too long", () => {
    const longString = "a".repeat(256);
    expect(() => digest.add(longString)).toThrow("String too long");
  });

  it("should throw an error if there is not enough space in memory", () => {
    const smallString = "a".repeat(255);
    const numStrings = Math.floor(STRING_SIZE / (smallString.length + 1));
    for (let i = 0; i < numStrings; i++) {
      digest.add(smallString);
    }
    expect(() => digest.add("b")).toThrow("String digest overflow");
  });

  it("should find an existing string and return -1 for a non-existent string", () => {
    const addr = digest.add("test");
    expect(digest.find("test")).toBe(addr);
    expect(digest.find("nonexistent")).toBe(-1);
  });

  it("intern should return the same address for duplicates and a different address for new strings", () => {
    const addr1 = digest.intern("hello");
    const addr2 = digest.intern("hello");
    expect(addr1).toBe(addr2);
    const addr3 = digest.intern("world");
    expect(addr3).not.toBe(addr1);
    expect(digest.get(addr1)).toBe("hello");
    expect(digest.get(addr3)).toBe("world");
  });

  it("should correctly handle adding and retrieving multiple strings", () => {
    const addr1 = digest.add("first");
    const addr2 = digest.add("second");
    const addr3 = digest.add("third");
    expect(digest.get(addr1)).toBe("first");
    expect(digest.get(addr2)).toBe("second");
    expect(digest.get(addr3)).toBe("third");
  });

  it("should correctly reset the digest", () => {
    digest.add("hello");
    digest.reset(10);
    expect(digest.SBP).toBe(10);
  });

  it("should throw an error when resetting to an invalid address", () => {
    expect(() => digest.reset(-1)).toThrow("Invalid reset address");
    expect(() => digest.reset(STRING_SIZE + 1)).toThrow(
      "Invalid reset address"
    );
  });

  it("should throw an error when reading from an invalid address", () => {
    expect(() => digest.get(-1)).toThrow("Address is outside memory bounds");
    expect(() => digest.get(STRING_SIZE)).toThrow(
      "Address is outside memory bounds"
    );
  });

  it("should correctly report remaining space", () => {
    const initialSpace = digest.remainingSpace;
    digest.add("data");
    expect(digest.remainingSpace).toBe(initialSpace - (1 + "data".length));
  });
});
