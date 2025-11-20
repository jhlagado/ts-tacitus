/**
 * Core test utilities that were previously exported from main source files
 * but are only used in tests. Moving them here keeps the main codebase clean.
 */

import {
  type VM,
  getTaggedInfo,
  Tagged,
  Tag,
  tagNames,
  memoryReadCell,
  memoryWriteCell,
} from '../../core';
import { push, ensureStackSize } from '../../core/vm';
import { decodeX1516 } from '../../core/code-ref';

/**
 * Print function for debugging tagged values during tests.
 * Previously exported from src/core/printer.ts.
 */
export function prn(title: string, tval: number): void {
  console.warn(`${title}: ${formatValue(tval, 0)}`);
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

  const header = Tagged(slotCount, Tag.LIST);
  push(vm, header);
}

function _reverseSpan(vm: VM, spanSize: number): void {
  if (spanSize <= 1) {
    return;
  }

  ensureStackSize(vm, spanSize, 'reverse span operation');

  const start = vm.sp - spanSize;
  const end = vm.sp - 1;

  for (let i = 0; i < Math.floor(spanSize / 2); i++) {
    const left = start + i;
    const right = end - i;

    const leftVal = memoryReadCell(vm.memory, left);
    const rightVal = memoryReadCell(vm.memory, right);

    memoryWriteCell(vm.memory, left, rightVal);
    memoryWriteCell(vm.memory, right, leftVal);
  }
}

function formatValue(tval: number, indent = 0): string {
  const { value: _value, tag } = getTaggedInfo(tval);
  const name = toTagName(tag);
  const prefix = `${'  '.repeat(indent)}${name}: `;
  return `${prefix}${scalarRepr(tval)}`;
}

function toTagName(tag: number): string {
  return tagNames[tag as Tag] || `UnknownTag(${tag})`;
}

function scalarRepr(tval: number): string {
  const { tag, value } = getTaggedInfo(tval);
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
    const { tag, value: tagValue } = getTaggedInfo(value);
    // Check Tag.CODE < 128 (represents builtin opcode)
    return tag === Tag.CODE && tagValue < 128;
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
    const { tag } = getTaggedInfo(value);
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
  const { value } = getTaggedInfo(builtinRef);
  return value;
}

/**
 * Extracts the bytecode address from a code reference.
 * For values < 128, returns the value directly (invalid X1516, treated as builtin opcode).
 * For values >= 128, decodes the X1516 encoded value back to the original address.
 * Test-only function.
 */
export function getCodeAddress(codeRef: number): number {
  if (!isFuncRef(codeRef)) {
    throw new Error('Value is not a code reference');
  }
  const { value } = getTaggedInfo(codeRef);
  // If value < 128, it's stored directly (not X1516 encoded)
  if (value < 128) {
    return value;
  }
  // Otherwise, decode X1516
  return decodeX1516(value);
}
