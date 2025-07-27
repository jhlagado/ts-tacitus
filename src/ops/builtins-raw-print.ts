/**
 * @file src/ops/builtins-raw-print.ts
 * Implementation of the raw print operation (".") for the Tacit VM.
 *
 * The raw print operation pops the top value from the stack and prints it as a raw tagged value.
 * Unlike the regular print operation, it does not interpret or format list structures.
 * For Tag.NUMBER values, it prints the raw floating-point value directly.
 * For other tagged values, it prints them in the format "TAG:VALUE".
 */
import { VM } from '../core/vm';
import { fromTaggedValue, Tag } from '../core/tagged';

/**
 * Raw print operation - prints the raw tagged value from the top of the stack.
 *
 * This operation:
 * 1. Pops the top value from the stack
 * 2. Decodes the NaN-boxed value to extract its tag and value
 * 3. For Tag.NUMBER (floating-point), prints the raw number value directly
 * 4. For other tags, prints in the format "TAG:VALUE" (e.g., "INTEGER:42")
 *
 * Unlike the regular print operation, this does not interpret list structures
 * or perform any special formatting. It shows the raw tagged value exactly as
 * stored in the VM.
 *
 * @param vm - The virtual machine instance
 * @throws {Error} Indirectly via vm.pop() if the stack is empty
 */
export function rawPrintOp(vm: VM): void {
  try {
    if (vm.SP < 1) {
      console.log('[Error: Stack empty]');
      return;
    }

    const value = vm.pop();

    const { tag, value: tagValue } = fromTaggedValue(value);

    if (tag === Tag.NUMBER) {
      console.log(String(tagValue));
    } else {
      const tagName = Tag[tag] || `UNKNOWN(${tag})`;
      console.log(`${tagName}:${tagValue}`);
    }
  } catch (error) {
    console.log(`[Raw print error: ${error instanceof Error ? error.message : String(error)}]`);
  }
}
