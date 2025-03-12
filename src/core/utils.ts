import { SEG_HEAP } from "./memory";
import { CoreTag, fromTaggedValue, HeapTag, isTaggedValue } from "./tagged-value";
import { VM } from "./vm";

// Character check functions
export const isDigit = (char: string): boolean => char >= "0" && char <= "9";

export const isWhitespace = (char: string): boolean => char.trim() === "";

export const isGroupingChar = (char: string): boolean =>
  "{}[]()\"'`".includes(char);

// Number conversion and logical operations
export const toUnsigned16 = (num: number): number => num & 0xffff;

export const toBoolean = (value: number): boolean => value !== 0;
export const toNumber = (value: boolean): number => (value ? 1 : 0);

export function toFloat32(value: number): number {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setFloat32(0, value, true);
  return view.getUint32(0, true);
}

export const not = (value: number): number => toNumber(!toBoolean(value));
export const and = (a: number, b: number): number =>
  toNumber(toBoolean(a) && toBoolean(b));
export const or = (a: number, b: number): number =>
  toNumber(toBoolean(a) || toBoolean(b));
export const xor = (a: number, b: number): number =>
  toNumber(toBoolean(a) !== toBoolean(b));

// Constants for vector/dict formatting
const VEC_SIZE = 4;
const VEC_DATA = 8;

/**
 * Formats a tagged value for display.
 * Decodes the underlying type and returns a human-readable string.
 *
 * @param vm - The VM instance used for decoding string values and accessing memory.
 * @param value32 - The tagged value to format.
 * @returns A formatted string representation of the tagged value.
 */
export function formatValue(vm: VM, value32: number): string {
  if (!isTaggedValue(value32)) {
    return value32.toString();
  }
  const { value, heap, tag } = fromTaggedValue(value32);
  if (!heap) {
    switch (tag) {
      case CoreTag.INTEGER:
        return value === 0 ? "NIL" : String(value);
      case CoreTag.CODE:
        return `CODE(${value})`;
      case CoreTag.STRING:
        try {
          const str = vm.digest.get(value);
          return `"${str}"`;
        } catch (error) {
          console.error((error as Error).message);
          return `STRING(${value})`;
        }
      default:
        return `Unknown core tag (${tag}, ${value})`;
    }
  } else {
    switch (tag) {
      case HeapTag.BLOCK:
        return `BLOCK(${value})`;
      case HeapTag.SEQ:
        return `SEQ(${value})`;
      case HeapTag.VECTOR:
      case HeapTag.DICT:
        try {
          const len = vm.memory.read16(SEG_HEAP, value + VEC_SIZE);
          const elems: string[] = [];
          for (let i = 0; i < len; i++) {
            const elem = vm.memory.readFloat(
              SEG_HEAP,
              value + VEC_DATA + i * 4
            );
            elems.push(formatValue(vm, elem));
          }
          return `[ ${elems.join(" ")} ]`;
        } catch (error) {
          console.error((error as Error).message);
          return tag === HeapTag.VECTOR
            ? `VECTOR(${value})`
            : `DICT(${value})`;
        }
      default:
        return `Unknown heap tag (${tag}, ${value})`;
    }
  }
}
