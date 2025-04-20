import { fromTaggedValue, CoreTag, HeapTag } from './tagged';
import { SequenceView }         from '../seq/sequenceView';
import { VectorView }           from '../heap/vectorView';
import { vm } from './globalState';

export function printValues(...tvals: (number | string)[]): void {
  for (let i = 0; i < tvals.length; i++) {
    const val = tvals[i];
    if (typeof val === 'number') {
      printValue(tvals[i] as number, 2);
    } else {
      console.log(tvals[i])
    }
  }
}

/**
 * Recursively prints any Tacit value (scalar, vector, dict, sequence, etc.)
 * with indentation, hex addresses, tags, and contents.
 */
export function printValue(tval: number, indent = 0): void {
  const { value: addr, heap: isHeap, tag } = fromTaggedValue(tval);
  const prefix = `${indentStr(indent)}${isHeap ? hex(addr) + ' ' : ''}${tagName(tag)}: `;

  if (!isHeap) {
    // Scalar or immediate
    console.warn(prefix + scalarRepr(tval, tag));
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
      console.warn(
        `${prefix}Sequence(type=${seq.type}, metaCount=${seq.metaCount}) {`
      );
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

function indentStr(level: number): string {
  return '  '.repeat(level);
}

function hex(addr: number): string {
  return '0x' + addr.toString(16);
}

function tagName(tag: number): string {
  // Map numeric tags back to friendly names
  if ((tag as CoreTag) in CoreTag)   return CoreTag[tag as CoreTag];
  if ((tag as HeapTag) in HeapTag)   return HeapTag[tag as HeapTag];
  return `#${tag}`;
}

function scalarRepr(tval: number, tag: number): string {
  if (tag === CoreTag.INTEGER)   return '<integer>';
  if (tag === CoreTag.NUMBER)    return tval.toString();
  if (tag === CoreTag.CODE)      return `<code ptr>`;
  // …other CoreTag cases…
  return tval.toString();
}
