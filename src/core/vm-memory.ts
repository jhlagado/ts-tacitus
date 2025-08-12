/**
 * @file src/core/vm-memory.ts
 * Memory access operations for segmented VM memory.
 * Direct mapping target for C memory access functions.
 */

import { VMCore, VMMemory } from './vm-types';
import { SEG_STACK, SEG_RSTACK, SEG_CODE, SEG_STRING } from './constants';

/**
 * Segment base address calculation
 * Maps to C macro: SEGMENT_BASE(seg)
 */
function getSegmentBase(segment: number): number {
  switch (segment) {
    case SEG_STACK: return 0;
    case SEG_RSTACK: return 16384;  // 16KB
    case SEG_CODE: return 20480;    // 16KB + 4KB  
    case SEG_STRING: return 28672;  // 16KB + 4KB + 8KB
    default: throw new Error(`Invalid segment: ${segment}`);
  }
}

/**
 * Memory access implementation
 * Direct mapping to C functions: vm_read8, vm_write32, etc.
 */
export const vmMemory: VMMemory = {
  read8(vm: VMCore, segment: number, addr: number): number {
    const base = getSegmentBase(segment);
    return vm.memory[base + addr];
  },

  read16(vm: VMCore, segment: number, addr: number): number {
    const base = getSegmentBase(segment);
    const low = vm.memory[base + addr];
    const high = vm.memory[base + addr + 1];
    return (high << 8) | low;
  },

  readFloat32(vm: VMCore, segment: number, addr: number): number {
    const base = getSegmentBase(segment);
    const view = new DataView(vm.memory.buffer, base + addr, 4);
    return view.getFloat32(0, true); // little endian
  },

  write8(vm: VMCore, segment: number, addr: number, value: number): void {
    const base = getSegmentBase(segment);
    vm.memory[base + addr] = value & 0xFF;
  },

  write16(vm: VMCore, segment: number, addr: number, value: number): void {
    const base = getSegmentBase(segment);
    vm.memory[base + addr] = value & 0xFF;
    vm.memory[base + addr + 1] = (value >> 8) & 0xFF;
  },

  writeFloat32(vm: VMCore, segment: number, addr: number, value: number): void {
    const base = getSegmentBase(segment);
    const view = new DataView(vm.memory.buffer, base + addr, 4);
    view.setFloat32(0, value, true); // little endian
  }
};