/**
 * @file builtins-raw-print.ts
 * Implementation of the raw print operation for the Tacit VM
 * This operation prints the raw tagged value on top of the stack
 */
import { VM } from '../core/vm';
import { fromTaggedValue, Tag } from '../core/tagged';

/**
 * Raw print operation - prints the raw tagged value on top of the stack
 * This is a raw operation that shows the NaN-boxed value without list interpretation
 */
export function rawPrintOp(vm: VM): void {
  if (vm.SP < 1) {
    console.log('[Error: Stack empty]');
    return;
  }

  // Get the top value and pop it
  const value = vm.pop();

  // Decode the NaN-boxed value but don't interpret list structures
  const { tag, value: tagValue } = fromTaggedValue(value);

  // Print numbers directly, and use TAG:VALUE format for other types
  if (tag === Tag.NUMBER) {
    console.log(String(tagValue));
  } else {
    const tagName = Tag[tag] || `UNKNOWN(${tag})`;
    console.log(`${tagName}:${tagValue}`);
  }
}
