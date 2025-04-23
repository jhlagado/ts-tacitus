import { vm } from '../core/globalState';
import { initializeInterpreter } from '../core/globalState';
import { rangeSource } from './source';
import { mapSeq, filterSeq, takeSeq } from './processor';
import { decRef, getRefCount } from '../heap/heapUtils';
import { executeProgram } from '../lang/interpreter';

describe('Sequence Cleanup', () => {
  beforeEach(() => {
    initializeInterpreter();
  });

  it('should properly cleanup sequence processors', () => {
    executeProgram('( 2 * )');
    const mapFunction = vm.pop();

    const range = rangeSource(vm.heap, 0, 10, 1);
    const initial = getRefCount(vm.heap, range);
    console.log('initial', initial);

    const mapSequence = mapSeq(vm.heap, range, mapFunction);
    decRef(vm.heap, range);
    expect(getRefCount(vm.heap, range)).toBe(initial);

    // disposing the seq will auto‑decRef the range
    decRef(vm.heap, mapSequence);

    expect(getRefCount(vm.heap, range)).toBe(0);
  });

  it('should properly cleanup sequence processor chains', () => {
    // Create functions
    executeProgram('( 2 * )');
    const mapFunction = vm.pop();

    executeProgram('( 10 > )');
    const filterFunction = vm.pop();

    // Create a processor chain: range -> map -> filter -> take
    const range = rangeSource(vm.heap, 0, 100, 1);
    expect(getRefCount(vm.heap, range)).toBe(1);

    // Build sequence chain
    // range is now owned by mapSequence
    const mapSequence = mapSeq(vm.heap, range, mapFunction);
    decRef(vm.heap, range);
    expect(getRefCount(vm.heap, range)).toBe(1);

    // mapSequence is now owned by filterSequence
    const filterSequence = filterSeq(vm.heap, mapSequence, filterFunction);
    decRef(vm.heap, mapSequence);
    expect(getRefCount(vm.heap, mapSequence)).toBe(1);

    // filterSequence is now owned by takeSequence
    const takeSequence = takeSeq(vm.heap, filterSequence, 10);
    decRef(vm.heap, filterSequence);
    expect(getRefCount(vm.heap, filterSequence)).toBe(1);

    // freeing takeSequence
    decRef(vm.heap, takeSequence);
    expect(getRefCount(vm.heap, filterSequence)).toBe(0);
    expect(getRefCount(vm.heap, mapSequence)).toBe(0);
    expect(getRefCount(vm.heap, range)).toBe(0);
  });

  it('should properly cleanup sequence processors', () => {
    executeProgram('( 2 * )');
    const mapFunction = vm.pop();

    const range = rangeSource(vm.heap, 0, 10, 1);
    const initial = getRefCount(vm.heap, range);
    console.log('initial', initial);

    const mapSequence = mapSeq(vm.heap, range, mapFunction);
    decRef(vm.heap, range);
    expect(getRefCount(vm.heap, range)).toBe(initial);

    // disposing the seq will auto‑decRef the range
    decRef(vm.heap, mapSequence);

    expect(getRefCount(vm.heap, range)).toBe(0);
  });
});
