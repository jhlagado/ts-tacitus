import { fromTaggedValue, CoreTag, HeapTag, heapTagNames, nonHeapTagNames } from './tagged';
import { SequenceView } from '../seq/sequenceView';
import { VectorView } from '../heap/vectorView';
import { vm } from './globalState';

/**
 * Recursively prints any Tacit value (scalar, vector, dict, sequence, etc.)
 * with indentation, hex addresses, tags, and contents.
 */
export function printValue(tval: number, title = ''): void {
  console.warn(title);
  printValueRec(tval, 0);
}

function printValueRec(tval: number, indent = 0): void {
  const { value: addr, isHeap, tag } = fromTaggedValue(tval);
  const tagName = toTagName(tag, isHeap);
  console.warn(`print: ${tagName}:${toHex(addr)} (${isHeap ? 'heap' : 'scalar'})`);
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
        printValueRec(view.element(i), indent + 1);
      }
      console.warn(`${indentStr(indent)}]`);
      break;
    }

    case HeapTag.SEQUENCE: {
      const seq = new SequenceView(vm.heap, addr);
      console.warn(`${prefix}Sequence(type=${seq.type}, metaCount=${seq.metaCount}) {`);
      for (let i = 0; i < seq.metaCount; i++) {
        printValueRec(seq.meta(i), indent + 1);
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
  switch (tag) {
    case CoreTag.INTEGER:
      return `${value}`;
    case CoreTag.CODE:
      return '<code>';
    case CoreTag.STRING:
      return vm.digest.get(value);
    default:
      return `${tval}`;
  }
}
