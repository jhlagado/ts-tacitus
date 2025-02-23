import { Heap } from "../core/heap";
import { VM } from "../core/vm";
import { seqNext } from "./sequence";
import { NIL } from "../core/tagged-value";

export function scanProcessor(heap: Heap, vm: VM, seq: number, func: number): void {
  while (true) {
    seqNext(heap, vm, seq); // Pushes values onto the stack
    const value = vm.pop();
    if (value === NIL) {
      return; // Sequence is exhausted
    }
    
    vm.push(value);
    vm.push(func); // Push function onto stack
    vm.eval(); // Execute function with values from the sequence
  }
}

export function filterProcessor(heap: Heap, vm: VM, seq: number, predicate: number): void {
  while (true) {
    seqNext(heap, vm, seq); // Pushes values onto the stack
    const value = vm.pop();
    if (value === NIL) {
      return; // Sequence is exhausted
    }
    
    vm.push(value);
    vm.push(predicate); // Push predicate function onto stack
    vm.eval(); // Execute predicate function
    
    const result = vm.pop(); // Retrieve boolean result
    if (result) {
      vm.push(value); // Keep value if predicate is true
      return;
    }
  }
}
