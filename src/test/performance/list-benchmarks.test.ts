import { describe, it, expect, beforeEach } from '@jest/globals';
import { VM } from '../../core/vm';
import { toTaggedValue, Tag, fromTaggedValue } from '../../core/tagged';
import {
  openRListOp,
  closeRListOp,
  rlistPrependOp,
  rlistAppendOp,
  rlistSlotOp,
} from '../../ops/builtins-list';

function newVM(): VM {
  const vm = new VM();
  vm.reset();
  return vm;
}

describe.skip('LIST Performance Benchmarks (non-failing)', () => {
  let vm: VM;
  beforeEach(() => {
    vm = newVM();
  });

  it('O(1) prepend scales to 3k without error', () => {
    // Start with empty LIST
    openRListOp(vm);
    closeRListOp(vm);

    let header = vm.pop();
    const N = 3_000; // keep runtime reasonable within stack limits

    for (let i = 0; i < N; i++) {
      vm.push(toTaggedValue(1, Tag.INTEGER)); // value to prepend
      vm.push(header);
      rlistPrependOp(vm);
      // After op, stack = [...payload..., newHeader]; capture header for next iteration
      header = vm.pop();
    }

    // Push back final header and verify slot count
    vm.push(header);
    rlistSlotOp(vm);
    const count = fromTaggedValue(vm.pop()).value;
    expect(count).toBe(N);
  });

  it('O(s) append handles 500 appends (sanity check)', () => {
    openRListOp(vm);
    closeRListOp(vm);

    const N = 500; // keep runtime and stack activity bounded
    let header = vm.pop();

    for (let i = 0; i < N; i++) {
      vm.push(toTaggedValue(1, Tag.INTEGER));
      vm.push(header);
      rlistAppendOp(vm);
      // After op, stack = [...payload..., newHeader]; capture header for next iteration
      header = vm.pop();
    }

    vm.push(header);
    rlistSlotOp(vm);
    const count = fromTaggedValue(vm.pop()).value;
    expect(count).toBe(N);
  });
});
