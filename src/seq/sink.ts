import { Heap } from '../heap/heap';
import { fromTaggedValue, isNIL, NIL } from '../core/tagged';
import { VM } from '../core/vm';
import { vectorCreate } from '../heap/vector';
import { seqNext } from './sequence';
import { callTacitFunction } from '../core/interpreter';

/**
 * Collects sequence values into a vector
 */
export function toVector(heap: Heap, vm: VM, seq: number): number {
  const values: number[] = [];
  while (true) {
    seqNext(heap, vm, seq);
    const value = vm.pop();
    if (isNIL(value)) break;
    values.push(value);
  }
  return vectorCreate(heap, values);
}

/**
 * Returns the last value in a sequence
 */
export function last(heap: Heap, vm: VM, seq: number): number {
  let lastValue = NIL;
  while (true) {
    seqNext(heap, vm, seq);
    const value = vm.pop();
    if (isNIL(value)) break;
    lastValue = value;
  }
  return lastValue;
}

/**
 * Applies a function to each value in a sequence
 */
export function forEach(heap: Heap, vm: VM, seq: number, func: number): void {
  const { value: funcPtr } = fromTaggedValue(func);
  while (true) {
    seqNext(heap, vm, seq);
    const value = vm.pop();
    if (isNIL(value)) return;
    vm.push(value);
    callTacitFunction(funcPtr);
  }
}

/**
 * Counts values in a sequence
 */
export function count(heap: Heap, vm: VM, seq: number): number {
  let n = 0;
  while (true) {
    seqNext(heap, vm, seq);
    if (isNIL(vm.pop())) break;
    n++;
  }
  return n;
}

/**
 * Reduces a sequence using a function
 */
export function reduce(
  heap: Heap,
  vm: VM,
  seq: number,
  func: number,
  initial: number,
  evalFn: () => void
): number {
  let acc = initial;
  while (true) {
    seqNext(heap, vm, seq);
    const value = vm.pop();
    if (isNIL(value)) break;
    vm.push(acc);
    vm.push(value);
    vm.push(func);
    evalFn();
    acc = vm.pop();
  }
  return acc;
}

/**
 * Finds first value matching a predicate
 */
export function find(heap: Heap, vm: VM, seq: number, pred: number, evalFn: () => void): number {
  while (true) {
    seqNext(heap, vm, seq);
    const value = vm.pop();
    if (isNIL(value)) return NIL;
    vm.push(value);
    vm.push(pred);
    evalFn();
    if (vm.pop() !== 0) return value;
  }
}

/**
 * Checks if any value matches a predicate
 */
export function any(heap: Heap, vm: VM, seq: number, pred: number, evalFn: () => void): number {
  while (true) {
    seqNext(heap, vm, seq);
    const value = vm.pop();
    if (isNIL(value)) return 0;
    vm.push(value);
    vm.push(pred);
    evalFn();
    if (vm.pop() !== 0) return 1;
  }
}

/**
 * Checks if all values match a predicate
 */
export function all(heap: Heap, vm: VM, seq: number, pred: number, evalFn: () => void): number {
  while (true) {
    seqNext(heap, vm, seq);
    const value = vm.pop();
    if (isNIL(value)) return 1;
    vm.push(value);
    vm.push(pred);
    evalFn();
    if (vm.pop() === 0) return 0;
  }
}
