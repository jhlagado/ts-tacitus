import { fromTaggedValue, CoreTag, HeapTag, heapTagNames, nonHeapTagNames } from './tagged';
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

  // Only VECTOR is supported now that sequences and dicts are removed
  if (tag === HeapTag.VECTOR) {
    const view = new VectorView(vm.heap, addr);
    let elems = '';
    for (let i = 0; i < view.length; i++) {
      if (i > 0) elems += '\n';
      elems += formatValue(view.element(i), indent + 1);
    }
    return `${prefix}Vector(len=${view.length}) [\n` + `${elems}\n` + `${'  '.repeat(indent)}]`;
  }
  return `${prefix}Unknown(${name})`;
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
