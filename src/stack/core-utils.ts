import { VM } from '../core/vm';
import { SEG_STACK } from '../core/memory';
import { fromTaggedValue, Tag } from '../core/tagged';
import { StackArgInfo } from './types';

const BYTES_PER_ELEMENT = 4;

/**
 * Core stack utilities used by the VM's core functionality.
 * This version is used by the VM's core operations.
 */

export function getStackArgInfo(vm: VM, offsetFromSp: number): StackArgInfo {
  const addr = vm.SP - offsetFromSp - BYTES_PER_ELEMENT;
  const value = vm.memory.readFloat32(SEG_STACK, addr);
  const { tag, value: tagValue } = fromTaggedValue(value);

  if (tag === Tag.TUPLE) {
    const tupleSize = (tagValue + 2) * BYTES_PER_ELEMENT;
    return [offsetFromSp + tupleSize, tupleSize];
  }

  return [offsetFromSp + BYTES_PER_ELEMENT, BYTES_PER_ELEMENT];
}

/**
 * Core implementation of findTuple used by VM core operations.
 */
export function findTuple(vm: VM, offset: number = 0) {
  try {
    const linkAddr = vm.SP - offset - BYTES_PER_ELEMENT;

    if (linkAddr < 0 || linkAddr >= vm.SP) {
      return null;
    }

    const linkValue = vm.memory.readFloat32(SEG_STACK, linkAddr);
    const linkDecoded = fromTaggedValue(linkValue);

    if (linkDecoded.tag !== Tag.LINK) {
      return null;
    }

    const totalElements = linkDecoded.value;
    const tupleStart = linkAddr - (totalElements * BYTES_PER_ELEMENT);

    if (tupleStart < 0) {
      return null;
    }

    const tupleTagValue = vm.memory.readFloat32(SEG_STACK, tupleStart);
    const tupleDecoded = fromTaggedValue(tupleTagValue);

    if (tupleDecoded.tag !== Tag.TUPLE) {
      return null;
    }

    const dataElements = tupleDecoded.value;

    if (totalElements !== dataElements + 1) {
      return null;
    }

    const totalSize = (dataElements + 2) * BYTES_PER_ELEMENT;
    const tupleEnd = tupleStart + totalSize;

    return {
      start: tupleStart,
      end: tupleEnd,
      size: dataElements,
      totalSize,
      linkOffset: totalSize - BYTES_PER_ELEMENT
    };
  } catch (_e) {
    return null;
  }
}
