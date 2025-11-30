import { lookup } from './dictionary';
import { isNIL } from './tagged';
import { push, type VM } from './vm';

/**
 * Resolves a symbol name to a tagged value from the dictionary.
 */
export function resolveSymbol(vm: VM, name: string): number | undefined {
  const result = lookup(vm, name);
  return isNIL(result) ? undefined : result;
}

/**
 * Pushes a symbol reference onto the stack by name.
 */
export function pushSymbolRef(vm: VM, name: string): void {
  const taggedValue = resolveSymbol(vm, name);
  if (taggedValue === undefined) {
    throw new Error(`Symbol not found: ${name}`);
  }
  push(vm, taggedValue);
}
