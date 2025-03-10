import { SEG_HEAP } from "./memory";
import { fromTaggedValue, HeapSubType, PrimitiveTag } from "./tagged";
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
  // We assume all numbers are canonicalized and therefore are tagged.
  const { tag, value, heapSubtype } = fromTaggedValue(value32);

  switch (tag) {
    case PrimitiveTag.FLOAT:
      if (Number.isNaN(value)) return "NaN";
      // Round to 6 decimals, then parseFloat + toString() to remove trailing zeroes
      return parseFloat(value.toFixed(4)).toString();
    case PrimitiveTag.INTEGER:
      return value === 0 ? "NIL" : String(value);
    case PrimitiveTag.CODE:
      return `CODE(${value})`;
    case PrimitiveTag.STRING:
      try {
        const str = vm.digest.get(value);
        return `"${str}"`;
      } catch (error) {
        console.error((error as Error).message);
        return `STRING(${value})`;
      }
    case PrimitiveTag.HEAP:
      return formatHeapValue(vm, value, heapSubtype);
    default:
      return `Unknown(${tag}, ${value})`;
  }
}

/**
 * Helper function to format HEAP tagged values based on their subtype.
 *
 * @param vm - The VM instance for memory access.
 * @param value - The memory address value.
 * @param heapSubtype - The subtype of the HEAP value.
 * @returns A formatted string representation of the HEAP value.
 */
function formatHeapValue(vm: VM, value: number, heapSubtype?: number): string {
  switch (heapSubtype) {
    case HeapSubType.BLOCK:
      return `BLOCK(${value})`;
    case HeapSubType.SEQ:
      return `SEQ(${value})`;
    case HeapSubType.VECTOR:
    case HeapSubType.DICT:
      try {
        const len = vm.memory.read16(SEG_HEAP, value + VEC_SIZE);
        const elems: string[] = [];
        for (let i = 0; i < len; i++) {
          const elem = vm.memory.readFloat(SEG_HEAP, value + VEC_DATA + i * 4);
          elems.push(formatValue(vm, elem));
        }
        return `[ ${elems.join(" ")} ]`;
      } catch (error) {
        console.error((error as Error).message);
        return heapSubtype === HeapSubType.VECTOR
          ? `VECTOR(${value})`
          : `DICT(${value})`;
      }
    default:
      return `Unknown HEAP subtype(${heapSubtype ?? "undefined"}, ${value})`;
  }
}
