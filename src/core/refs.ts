/**
 * @file src/core/refs.ts
 * Reference utilities for polymorphic memory addressing
 */

import { VM } from './vm';
import { fromTaggedValue, toTaggedValue, getTag, Tag } from './tagged';
import { SEG_STACK, SEG_RSTACK } from './constants';

/**
 * Checks if a value is a reference (STACK_REF, LOCAL_REF, or GLOBAL_REF).
 */
export function isRef(tval: number): boolean {
  const { tag } = fromTaggedValue(tval);
  return tag === Tag.STACK_REF || tag === Tag.LOCAL_REF || tag === Tag.GLOBAL_REF;
}

/**
 * Checks if a value is a STACK_REF.
 */
export function isStackRef(tval: number): boolean {
  const { tag } = fromTaggedValue(tval);
  return tag === Tag.STACK_REF;
}

/**
 * Checks if a value is a LOCAL_REF.
 */
export function isLocalRef(tval: number): boolean {
  const { tag } = fromTaggedValue(tval);
  return tag === Tag.LOCAL_REF;
}

/**
 * Checks if a value is a GLOBAL_REF.
 */
export function isGlobalRef(tval: number): boolean {
  const { tag } = fromTaggedValue(tval);
  return tag === Tag.GLOBAL_REF;
}

/**
 * Creates a STACK_REF tagged value.
 */
export function createStackRef(cellIndex: number): number {
  if (cellIndex < 0 || cellIndex > 65535) {
    throw new Error('Stack cell index must be 0-65535');
  }
  return toTaggedValue(cellIndex, Tag.STACK_REF);
}

/**
 * Creates a LOCAL_REF tagged value.
 */
export function createLocalRef(slot: number): number {
  return toTaggedValue(slot, Tag.LOCAL_REF);
}

/**
 * Creates a GLOBAL_REF tagged value.
 */
export function createGlobalRef(key: number): number {
  return toTaggedValue(key, Tag.GLOBAL_REF);
}

/**
 * Result of reference resolution containing memory address and segment.
 */
export interface ResolvedReference {
  address: number;
  segment: number;
}

/**
 * Polymorphic reference resolver that handles all reference types.
 * Returns the byte address and memory segment for any reference type.
 */
export function resolveReference(vm: VM, ref: number): ResolvedReference {
  const tag = getTag(ref);
  const { value } = fromTaggedValue(ref);
  
  switch (tag) {
    case Tag.STACK_REF:
      return {
        address: value * 4, // Convert cell index to byte address
        segment: SEG_STACK
      };
      
    case Tag.LOCAL_REF:
      return {
        address: vm.BP + value * 4, // Slot offset from base pointer
        segment: SEG_RSTACK
      };
      
    case Tag.GLOBAL_REF:
      // Future: global segment addressing
      throw new Error('Global variable references not yet implemented');
      
    default:
      throw new Error(`Invalid reference type: ${tag}`);
  }
}

/**
 * Reads a value from memory using a polymorphic reference.
 */
export function readReference(vm: VM, ref: number): number {
  const { address, segment } = resolveReference(vm, ref);
  return vm.memory.readFloat32(segment, address);
}

/**
 * Writes a value to memory using a polymorphic reference.
 */
export function writeReference(vm: VM, ref: number, value: number): void {
  const { address, segment } = resolveReference(vm, ref);
  vm.memory.writeFloat32(segment, address, value);
}