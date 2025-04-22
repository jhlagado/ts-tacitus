import { fromTaggedValue, CoreTag, HeapTag, heapTagNames, nonHeapTagNames } from './tagged';
import { SequenceView } from '../seq/sequenceView';
import { VectorView } from '../heap/vectorView';
import { vm } from './globalState';

/**
 * Recursively prints any Tacit value with indentation, hex addresses, tags, and contents.
 */
export function prn(title: string, tval: number): void {
  console.warn(`${title ?? ''}: ${formatValue(tval, 0)}`);
}

function formatValue(tval: number, indent = 0): string {
  const { value: addr, isHeap, tag } = fromTaggedValue(tval);
  const name = toTagName(tag, isHeap);
  const prefix = `${'  '.repeat(indent)}${isHeap ? `${toHex(addr)} ` : ''}${name}: `;

  if (!isHeap) {
    // Scalar or immediate
    return `${prefix}${scalarRepr(tval)}`;
  }

  // Heap‐allocated object
  switch (tag as HeapTag) {
    case HeapTag.VECTOR: {
      const view = new VectorView(vm.heap, addr);
      const elems = Array.from({ length: view.length }, (_, i) =>
        formatValue(view.element(i), indent + 1)
      ).join('\n');
      return `${prefix}Vector(len=${view.length}) [\n` + `${elems}\n` + `${'  '.repeat(indent)}]`;
    }

    case HeapTag.SEQUENCE: {
      const seq = new SequenceView(vm.heap, addr);
      const metas = Array.from({ length: seq.metaCount }, (_, i) =>
        formatValue(seq.meta(i), indent + 1)
      ).join('\n');
      return (
        `${prefix}Sequence(type=${seq.type}, metaCount=${seq.metaCount}) {\n` +
        `${metas}\n` +
        `${'  '.repeat(indent)}}`
      );
    }

    // TODO: other heap types

    default:
      return `${prefix}<unrecognized heap tag>`;
  }
}

function toHex(addr: number): string {
  return `0x${addr.toString(16)}`;
}

function toTagName(tag: number, heap: boolean): string {
  return heap ? heapTagNames[tag as HeapTag] : nonHeapTagNames[tag as CoreTag];
}

function scalarRepr(tval: number): string {
  const { tag, value } = fromTaggedValue(tval);
  switch (tag) {
    case CoreTag.INTEGER:
      return `${value}`;
    case CoreTag.CODE:
      return `<code>`;
    case CoreTag.STRING:
      return `"${vm.digest.get(value)}"`;
    default:
      return `${tval}`;
  }
}
