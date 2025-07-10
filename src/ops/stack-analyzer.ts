import { VM } from '../core/vm';
import { SEG_STACK } from '../core/memory';
import { fromTaggedValue, toTaggedValue, Tag } from '../core/tagged';

const BYTES_PER_ELEMENT = 4;

export interface StackValue {
  type: 'number' | 'tuple' | 'unknown';
  address: number;      // Memory address of this value
  size: number;         // Size in bytes
  value?: any;          // Decoded value if applicable
  tag?: Tag;            // Tag if available
}

export interface TupleInfo extends StackValue {
  type: 'tuple';
  elementCount: number;  // Number of data elements (excluding TUPLE and LINK tags)
  totalElements: number; // Total elements including TUPLE and LINK tags
  linkOffset: number;    // Offset of LINK tag from start of tuple
  elements: StackValue[]; // Array of element values
}

/**
 * Analyzes the stack and returns information about values at the given offsets
 * @param vm The virtual machine instance
 * @param offsets Array of offsets from the current stack pointer to analyze
 * @returns Array of StackValue or TupleInfo objects
 */
export function analyzeStackValues(vm: VM, offsets: number[]): (StackValue | TupleInfo)[] {
  return offsets.map(offset => {
    const address = vm.SP - offset - BYTES_PER_ELEMENT;
    
    // Check bounds
    if (address < 0 || address >= vm.SP) {
      return { type: 'unknown', address, size: BYTES_PER_ELEMENT };
    }
    
    // Read the value and its tag
    const rawValue = vm.memory.readFloat32(SEG_STACK, address);
    const { tag, value } = fromTaggedValue(rawValue);
    
    // If it's a TUPLE tag, try to get the full tuple info
    if (tag === Tag.TUPLE) {
      return findTuple(vm, offset) || 
        { type: 'unknown', address, size: BYTES_PER_ELEMENT, tag, value };
    }
    
    // For other types, return basic info
    return {
      type: tag === Tag.NUMBER ? 'number' : 'unknown',
      address,
      size: BYTES_PER_ELEMENT,
      tag,
      value
    };
  });
}

/**
 * Finds a tuple starting at the given offset from the stack pointer
 * @param vm The virtual machine instance
 * @param offset Offset in bytes from the stack pointer to the potential TUPLE tag
 * @returns TupleInfo if a valid tuple is found, null otherwise
 */
function findTuple(vm: VM, offset: number): TupleInfo | null {
  const tupleStart = vm.SP - offset - BYTES_PER_ELEMENT;
  
  // Check bounds
  if (tupleStart < 0) {
    return null;
  }
  
  // Read and verify the TUPLE tag
  const tupleTagValue = vm.memory.readFloat32(SEG_STACK, tupleStart);
  const tupleDecoded = fromTaggedValue(tupleTagValue);
  
  if (tupleDecoded.tag !== Tag.TUPLE) {
    return null;
  }
  
  const elementCount = tupleDecoded.value;
  const linkAddr = tupleStart + (elementCount + 1) * BYTES_PER_ELEMENT;
  
  // Verify we have enough space for the LINK tag
  if (linkAddr >= vm.SP) {
    return null;
  }
  
  // Read and verify the LINK tag
  const linkValue = vm.memory.readFloat32(SEG_STACK, linkAddr);
  const linkDecoded = fromTaggedValue(linkValue);
  
  if (linkDecoded.tag !== Tag.LINK || linkDecoded.value !== elementCount + 1) {
    return null;
  }
  
  // Read all elements
  const elements: StackValue[] = [];
  for (let i = 0; i < elementCount; i++) {
    const elemAddr = tupleStart + (i + 1) * BYTES_PER_ELEMENT;
    const elemValue = vm.memory.readFloat32(SEG_STACK, elemAddr);
    const { tag, value } = fromTaggedValue(elemValue);
    
    elements.push({
      type: tag === Tag.NUMBER ? 'number' : 'unknown',
      address: elemAddr,
      size: BYTES_PER_ELEMENT,
      tag,
      value
    });
  }
  
  return {
    type: 'tuple',
    address: tupleStart,
    size: (elementCount + 2) * BYTES_PER_ELEMENT, // TUPLE + elements + LINK
    elementCount,
    totalElements: elementCount + 2, // +2 for TUPLE and LINK tags
    linkOffset: (elementCount + 1) * BYTES_PER_ELEMENT, // Offset to LINK from start
    elements
  };
}

/**
 * Helper function to get stack values for rangeRoll operation
 * @param vm The virtual machine instance
 * @param count Number of arguments to analyze (default: 3 for rangeRoll)
 * @returns Array of stack values with their types and positions
 */
export function getRangeRollArgs(vm: VM, count: number = 3): (StackValue | TupleInfo)[] {
  // For rangeRoll, we need to look at the top 3 stack items
  const offsets = Array.from({ length: count }, (_, i) => (i + 1) * BYTES_PER_ELEMENT);
  return analyzeStackValues(vm, offsets);
}
