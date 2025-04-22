import { VM } from '../core/vm';
import { SequenceView } from './sequenceView';
import { NIL, isNIL, fromTaggedValue } from '../core/tagged';
import { callTacitFunction } from '../lang/interpreter';
import { ProcType } from './sequence';
import { prn } from '../core/printer';

/** PROC_MAP: apply func to each element of the source seq */
export function handleProcMap(vm: VM, seq: number, seqv: SequenceView): number {
  const source = seqv.meta(1);
  const func = seqv.meta(2);
  const { value: fnPtr } = fromTaggedValue(func);

  // advance child, pop its value
  seqv.next(vm, source);
  const v = vm.pop();
  if (isNIL(v)) {
    vm.push(NIL);
  } else {
    vm.push(v);
    callTacitFunction(fnPtr);
  }
  return seq;
}

/** PROC_SIFT: keep element if corresponding mask seq yields truthy */
export function handleProcSift(vm: VM, seq: number, seqv: SequenceView): number {
  const source = seqv.meta(1);
  const maskSeq = seqv.meta(2);

  seqv.next(vm, source);
  let v = vm.pop();
  if (isNIL(v)) {
    vm.push(NIL);
    return seq;
  }

  seqv.next(vm, maskSeq);
  const m = vm.pop();
  if (isNIL(m) || !m) {
    // skip this element → advance top‑level seq
    return seqv.next(vm, seq);
  }

  vm.push(v);
  return seq;
}

/** PROC_FILTER: keep element if predicate(seqElem) is truthy */
export function handleProcFilter(vm: VM, seq: number, seqv: SequenceView): number {
  const source = seqv.meta(1);
  const predicateFunc = seqv.meta(2);

  seqv.next(vm, source);
  let v = vm.pop();
  if (isNIL(v)) {
    vm.push(NIL);
    return seq;
  }

  vm.push(v);
  vm.push(predicateFunc);
  vm.eval();
  const keep = vm.pop();
  if (isNIL(keep) || !keep) {
    // skip → advance top‑level seq
    return seqv.next(vm, seq);
  }

  vm.push(v);
  return seq;
}

/** PROC_TAKE: take first N elements, then yield NIL forever */
export function handleProcTake(vm: VM, seq: number, seqv: SequenceView): number {
  const limit = seqv.meta(2);
  const idx = seqv.cursor;
  prn('limit', limit);

  if (idx >= limit) {
    vm.push(NIL);
    return seq;
  }

  const source = seqv.meta(1);
  seqv.next(vm, source);
  const v = vm.pop();
  if (isNIL(v)) {
    vm.push(NIL);
    return seq;
  }

  seqv.cursor = idx + 1;
  vm.push(v);
  return seq;
}

/** PROC_DROP: skip first N elements, then yield rest */
export function handleProcDrop(vm: VM, seq: number, seqv: SequenceView): number {
  const toDrop = seqv.meta(2);
  let dropped = seqv.cursor;

  while (dropped < toDrop) {
    seqv.next(vm, seqv.meta(1));
    vm.pop(); // discard
    dropped++;
    seqv.cursor = dropped;
  }

  // now yield the next element
  return seqv.next(vm, seqv.meta(1));
}

/** PROC_MULTI: advance N sub‑sequences in lock‑step, return NIL on any end */
export function handleProcMulti(vm: VM, seq: number, seqv: SequenceView): number {
  const n = seqv.metaCount - 1;
  for (let i = 1; i <= n; i++) {
    const sub = seqv.meta(i);
    seqv.next(vm, sub);
    const v = vm.pop();
    if (isNIL(v)) {
      vm.push(NIL);
      return seq;
    }
  }
  return seq;
}

/** PROC_MULTI_SOURCE: like MULTI but yields all collected values each step */
export function handleProcMultiSource(vm: VM, seq: number, seqv: SequenceView): number {
  const n = seqv.metaCount - 1;
  for (let i = 1; i <= n; i++) {
    const src = seqv.meta(i);
    seqv.next(vm, src);
    const v = vm.pop();
    if (isNIL(v)) {
      vm.push(NIL);
      return seq;
    }
    vm.push(v);
  }
  return seq;
}

export function handleProcessorNext(vm: VM, seq: number) {
  const { value: seqPtr } = fromTaggedValue(seq);
  const seqv = new SequenceView(vm.heap, seqPtr);
  const op = seqv.processorType; // meta[0]
  console.log('handleProcessorNext', op);
  switch (op) {
    case ProcType.MAP:
      return handleProcMap(vm, seq, seqv);
    case ProcType.FILTER:
      return handleProcFilter(vm, seq, seqv);
    case ProcType.SIFT:
      return handleProcSift(vm, seq, seqv);
    case ProcType.TAKE:
      return handleProcTake(vm, seq, seqv);
    case ProcType.DROP:
      return handleProcDrop(vm, seq, seqv);
    case ProcType.MULTI:
      return handleProcMulti(vm, seq, seqv);
    case ProcType.MULTI_SOURCE:
      return handleProcMultiSource(vm, seq, seqv);
    default:
      vm.push(NIL);
      return seq;
  }
}
