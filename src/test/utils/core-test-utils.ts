/**
 * Core test utilities that were previously exported from main source files
 * but are only used in tests. Moving them here keeps the main codebase clean.
 */

import { VM } from '../../core/vm';
import { fromTaggedValue, toTaggedValue, Tag, tagNames } from '../../core/tagged';

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

  // Push values in forward order
  for (const value of values) {
    vm.push(value);
  }

  // Reverse the span to achieve LIST layout
  if (slotCount > 1) {
    reverseSpan(vm, slotCount);
  }

  // Push LIST header with slot count
  const header = toTaggedValue(slotCount, Tag.LIST);
  vm.push(header);
}

// Helper function for createList - reverses a span on the VM stack
function reverseSpan(vm: VM, spanSize: number): void {
  if (spanSize <= 1) return; // Nothing to reverse

  vm.ensureStackSize(spanSize, 'reverse span operation');

  const startAddr = vm.SP - spanSize * 4;
  const endAddr = vm.SP - 4;

  // In-place reversal using temporary storage
  for (let i = 0; i < Math.floor(spanSize / 2); i++) {
    const leftAddr = startAddr + i * 4;
    const rightAddr = endAddr - i * 4;

    const leftValue = vm.memory.readFloat32(0, leftAddr); // SEG_STACK = 0
    const rightValue = vm.memory.readFloat32(0, rightAddr);

    vm.memory.writeFloat32(0, leftAddr, rightValue);
    vm.memory.writeFloat32(0, rightAddr, leftValue);
  }
}

// Helper functions for prn()
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
