import { Tag, fromTaggedValue } from './tagged';
import { VM } from './vm';

// Character check functions
export const isDigit = (char: string): boolean => char >= '0' && char <= '9';

export const isWhitespace = (char: string): boolean => char.trim() === '';

export const isGroupingChar = (char: string): boolean => '{}[]()"\'`'.includes(char);

export const isSpecialChar = (char: string): boolean => ':"\'`'.includes(char);

export const isSymbolTerminator = (char: string): boolean => ')]}'.includes(char);

// Number conversion and logical operations
export const toUnsigned16 = (num: number): number => num & 0xffff;

export const toBoolean = (value: number): boolean => value !== 0;
export const toNumber = (value: boolean): number => (value ? 1 : 0);

export function toFloat32(value: number): number {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setFloat32(0, value, true);
  return view.getFloat32(0, true);
}

export const not = (value: number): number => toNumber(!toBoolean(value));
export const and = (a: number, b: number): number => toNumber(toBoolean(a) && toBoolean(b));
export const or = (a: number, b: number): number => toNumber(toBoolean(a) || toBoolean(b));
export const xor = (a: number, b: number): number => toNumber(toBoolean(a) !== toBoolean(b));


/**
 * Formats a tagged value for display.
 * Decodes the underlying type and returns a human-readable string.
 *
 * @param vm - The VM instance used for decoding string values and accessing memory.
 * @param value32 - The tagged value to format.
 * @returns A formatted string representation of the tagged value.
 */
export function formatValue(vm: VM, value32: number): string {
  const { value, tag } = fromTaggedValue(value32);
  // All values should be non-heap since heap allocation is not supported
  switch (tag) {
    case Tag.NUMBER:
      // Format numbers that are very close to integers as integers
      const roundedValue = Math.round(value32);
      if (Math.abs(value32 - roundedValue) < 0.01) {
        return roundedValue.toString();
      }
      return value32.toString();
    case Tag.INTEGER:
      return value === 0 ? 'NIL' : String(value);
    case Tag.CODE:
      return `CODE(${value})`;
    case Tag.STRING:
      try {
        const str = vm.digest.get(value);
        return `"${str}"`;
      } catch (_error) {
        return '""';
      }
    default:
      return 'NaN';
  }
}
