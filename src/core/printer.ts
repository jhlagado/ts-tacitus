import { fromTaggedValue, CoreTag, HeapTag, heapTagNames, nonHeapTagNames } from './tagged';
import { SequenceView } from '../seq/sequenceView';
import { VectorView } from '../heap/vectorView';
import { vm } from './globalState';

export function printValues(...tvals: (number | string)[]): void {
  for (let i = 0; i < tvals.length; i++) {
    const val = tvals[i];
    if (typeof val === 'number') {
      printValue(tvals[i] as number, 2);
    } else {
      console.log(tvals[i]);
    }
  }
}

/**
 * Recursively prints any Tacit value (scalar, vector, dict, sequence, etc.)
 * with indentation, hex addresses, tags, and contents.
 */
export function printValue(tval: number, indent = 0): void {
  const { value: addr, isHeap, tag } = fromTaggedValue(tval);
  console.warn(`print: ${tag}:${toHex(addr)} = ${toHex(addr)} (${isHeap ? 'heap' : 'scalar'})`);
  const prefix = `${indentStr(indent)}${isHeap ? toHex(addr) + ' ' : ''}${toTagName(
    tag,
    isHeap
  )}: `;

  if (!isHeap) {
    // Scalar or immediate
    console.warn(prefix + scalarRepr(tval));
    return;
  }

  // Heap‐allocated object
  switch (tag as HeapTag) {
    case HeapTag.VECTOR: {
      const view = new VectorView(vm.heap, addr);
      console.warn(`${prefix}Vector(len=${view.length}) [`);
      for (let i = 0; i < view.length; i++) {
        printValue(view.element(i), indent + 1);
      }
      console.warn(`${indentStr(indent)}]`);
      break;
    }

    case HeapTag.SEQUENCE: {
      const seq = new SequenceView(vm.heap, addr);
      console.warn(`${prefix}Sequence(type=${seq.type}, metaCount=${seq.metaCount}) {`);
      for (let i = 0; i < seq.metaCount; i++) {
        printValue(seq.meta(i), indent + 1);
      }
      console.warn(`${indentStr(indent)}}`);
      break;
    }

    // TODO: add DICT, STRING, CONSTANT, RANGE cases here

    default:
      console.warn(prefix + `<unrecognized heap tag>`);
  }
}

export function indentStr(level: number): string {
  return '  '.repeat(level);
}

export function toHex(addr: number): string {
  return '0x' + addr.toString(16);
}

export function toTagName(tag: number, heap: boolean): string {
  if (heap) {
    return heapTagNames[tag as HeapTag];
  } else {
    return nonHeapTagNames[tag as CoreTag];
  }
}

function scalarRepr(tval: number): string {
  const { tag, value } = fromTaggedValue(tval);
  let val: number | string = tval;
  let name = 'NUMBER';
  switch (tag) {
    case CoreTag.INTEGER:
      name = 'INTEGER';
      val = value;
      break;
    case CoreTag.CODE:
      name = 'CODE';
      val = '<code>';
      break;
    case CoreTag.STRING:
      name = 'STRING';
      val = vm.digest.get(value);
  }
  const result = `${name}: ${val}`;
  return result;
}
