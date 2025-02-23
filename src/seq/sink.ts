import { Heap } from "../core/heap";
import { VM } from "../core/vm";
import { seqNext } from "./sequence";
import { NIL } from "../core/tagged-value";
import { vectorCreate } from "../data/vector";

export function toVectorSink(heap: Heap, vm: VM, seq: number): number {
  const values: number[] = [];
  while (true) {
    seqNext(heap, vm, seq);
    const value = vm.pop();
    if (value === NIL) {
      break;
    }
    values.push(value);
  }
  return vectorCreate(heap, values);
}

export function lastSink(heap: Heap, vm: VM, seq: number): number {
  let lastValue: number = NIL;
  while (true) {
    seqNext(heap, vm, seq);
    const value = vm.pop();
    if (value === NIL) {
      return lastValue; // Return the last valid value
    }
    lastValue = value;
  }
}

export function forEachSink(
  heap: Heap,
  vm: VM,
  seq: number,
  func: number
): void {
  while (true) {
    seqNext(heap, vm, seq);
    const value = vm.pop();
    if (value === NIL) {
      return; // Sequence is exhausted
    }

    vm.push(value);
    vm.push(func); // Push function onto stack
    vm.eval(); // Execute function with values from the sequence
  }
}

