/**
 * Core test utilities that were previously exported from main source files
 * but are only used in tests. Moving them here keeps the main codebase clean.
 */

import type { VM } from '../../core';
import { fromTaggedValue, toTaggedValue, Tag, tagNames, CELL_SIZE, SEG_DATA } from '../../core';
import { push, ensureStackSize } from '../../core/vm';

/**
 * Print function for debugging tagged values during tests.
 * Previously exported from src/core/printer.ts.
 */
export function prn(title: string, tval: number): void {
  console.warn(`${title ?? ''}: ${formatValue(tval, 0)}`);
}

/**
 * Create a list on the VM stack for testing purposes.
 * Previously exported from src/core/list.ts.
 */
export function createList(vm: VM, values: number[]): void {
  const slotCount = values.length;

  for (const value of values) {
    push(vm, value);
  }

  if (slotCount > 1) {
    _reverseSpan(vm, slotCount);
  }

  const header = toTaggedValue(slotCount, Tag.LIST);
  push(vm, header);
}

function _reverseSpan(vm: VM, spanSize: number): void {
  if (spanSize <= 1) {
return;
}

  ensureStackSize(vm, spanSize, 'reverse span operation');

  // Use absolute cell indices
  const startCell = vm.sp - spanSize;
  const endCell = vm.sp - 1;

  for (let i = 0; i < Math.floor(spanSize / 2); i++) {
    const leftAddr = (startCell + i) * CELL_SIZE;
    const rightAddr = (endCell - i) * CELL_SIZE;

    const leftValue = vm.memory.readFloat32(SEG_DATA, leftAddr);
    const rightValue = vm.memory.readFloat32(SEG_DATA, rightAddr);

    vm.memory.writeFloat32(SEG_DATA, leftAddr, rightValue);
    vm.memory.writeFloat32(SEG_DATA, rightAddr, leftValue);
  }
}

function formatValue(tval: number, indent = 0): string {
  const { value: _value, tag } = fromTaggedValue(tval);
  const name = toTagName(tag);
  const prefix = `${'  '.repeat(indent)}${name}: `;
  return `${prefix}${scalarRepr(tval)}`;
}

function toTagName(tag: number): string {
  return tagNames[tag as Tag] || `UnknownTag(${tag})`;
}

function scalarRepr(tval: number): string {
  const { tag, value } = fromTaggedValue(tval);
  switch (tag) {
    case Tag.SENTINEL:
      return `${value}`;
    case Tag.CODE:
      return `<code>`;
    case Tag.STRING:
      return `"[string:${value}]"`;
    default:
      return `${tval}`;
  }
}
/**
 * Checks if a tagged value represents a built-in operation reference.
 * Test-only function.
 */
export function isBuiltinRef(value: number): boolean {
  try {
    const { tag } = fromTaggedValue(value);
    return tag === Tag.BUILTIN;
  } catch {
    return false;
  }
}

/**
 * Checks if a tagged value represents a bytecode reference.
 * Test-only function.
 */
export function isFuncRef(value: number): boolean {
  try {
    const { tag } = fromTaggedValue(value);
    return tag === Tag.CODE;
  } catch {
    return false;
  }
}

/**
 * Checks if a tagged value represents any kind of executable code reference.
 * Test-only function.
 */
export function isExecutableRef(value: number): boolean {
  return isBuiltinRef(value) || isFuncRef(value);
}

/**
 * Extracts the opcode from a built-in reference.
 * Test-only function.
 */
export function getBuiltinOpcode(builtinRef: number): number {
  if (!isBuiltinRef(builtinRef)) {
    throw new Error('Value is not a built-in reference');
  }
  const { value } = fromTaggedValue(builtinRef);
  return value;
}

/**
 * Extracts the bytecode address from a code reference.
 * Test-only function.
 */
export function getCodeAddress(codeRef: number): number {
  if (!isFuncRef(codeRef)) {
    throw new Error('Value is not a code reference');
  }
  const { value } = fromTaggedValue(codeRef);
  return value;
}
