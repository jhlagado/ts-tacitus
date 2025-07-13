/**
 * @file builtins-raw-print.ts
 * Implementation of the raw print operation for the Tacit VM
 * This operation prints the raw tagged value on top of the stack
 */
import { VM } from '../core/vm';
import { fromTaggedValue, Tag } from '../core/tagged';

/**
 * Raw print operation - prints the raw tagged value on top of the stack
 * Format: "TAG:VALUE" (e.g., "LINK:3" or "NUMBER:42")
 */
export function rawPrintOp(vm: VM): void {
  if (vm.SP < 1) {
    console.log('[Error: Stack empty]');
    return;
  }

  const value = vm.pop();
  const { tag, value: tagValue } = fromTaggedValue(value);
  
  // Format as plain number for numbers, "TAG:VALUE" for other types
  if (tag === Tag.NUMBER) {
    console.log(String(tagValue));
  } else {
    const tagName = Tag[tag] || `UNKNOWN(${tag})`;
    console.log(`${tagName}:${tagValue}`);
  }
}
