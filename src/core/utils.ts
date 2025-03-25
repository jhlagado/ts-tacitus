import { SEG_HEAP } from "./memory";
import { CoreTag, fromTaggedValue, HeapTag } from "./tagged";
import { VM } from "./vm";
import { vectorGet } from "../heap/vector"; // Add this import

// Character check functions
export const isDigit = (char: string): boolean => char >= "0" && char <= "9";

export const isWhitespace = (char: string): boolean => char.trim() === "";

export const isGroupingChar = (char: string): boolean =>
  "{}[]()\"'`".includes(char);

export const isSpecialChar = (char: string): boolean =>
  "():\"'`".includes(char);

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

/**
 * Formats a tagged value for display.
 * Decodes the underlying type and returns a human-readable string.
 *
 * @param vm - The VM instance used for decoding string values and accessing memory.
 * @param value32 - The tagged value to format.
 * @returns A formatted string representation of the tagged value.
 */
export function formatValue(vm: VM, value32: number): string {
  const { value, heap, tag } = fromTaggedValue(value32);
  if (!heap) {
    switch (tag) {
      case CoreTag.NUMBER:
        return value32.toString();
      case CoreTag.INTEGER:
        return value === 0 ? "NIL" : String(value);
      case CoreTag.CODE:
        return `CODE(${value})`;
      case CoreTag.STRING:
        const str = vm.digest.get(value);
        return `"${str}"`;
      default:
        return 'NaN';
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

          // Use vectorGet instead of direct memory access
          for (let i = 0; i < len; i++) {
            // This is the key change - use vectorGet instead of readFloat
            const elem = vectorGet(vm.heap, value32, i);
            elems.push(formatValue(vm, elem));
          }

          return `[ ${elems.join(" ")} ]`;
        } catch (error) {
          console.error((error as Error).message);
          return tag === HeapTag.VECTOR ? `VECTOR(${value})` : `DICT(${value})`;
        }
      default:
        return `Unknown heap tag (${tag}, ${value})`;
    }
  }
}
