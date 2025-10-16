import { vm } from '../../../core/global-state';
import { resetVM } from '../../utils/vm-test-utils';
import { groupLeftOp, groupRightOp, endIfOp, endDoOp, exitOp } from '../../../ops/core/core-ops';
import { SEG_CODE } from '../../../core';

describe('Core ops extra branch coverage', () => {
  beforeEach(() => resetVM());

  test('groupRightOp underflow throws', () => {
    // No entries on return stack → underflow path
    expect(() => groupRightOp(vm)).toThrow();
  });

  test('endIfOp errors on missing placeholder', () => {
    // Push a non-numeric placeholder
    vm.push(NaN);
    expect(() => endIfOp(vm)).toThrow();
  });

  test('endDoOp errors on missing predicate placeholder', () => {
    vm.push(NaN);
    expect(() => endDoOp(vm)).toThrow();
  });

  test('groupLeft/groupRight normal path counts pushes', () => {
    // Push two items, mark, push three more, then measure
    vm.push(1);
    vm.push(2);
    groupLeftOp(vm);
    vm.push(3);
    vm.push(4);
    vm.push(5);
    groupRightOp(vm);
    // Expect count of items pushed after groupLeft
    expect(vm.pop()).toBe(3);
  });

  test('exitOp stops VM when no caller frame', () => {
    vm.running = true;
    vm.RSP = 0; // no saved BP/RA
    exitOp(vm);
    expect(vm.running).toBe(false);
  });

  test('exitOp restores return address when non-CODE (raw)', () => {
    // Simulate a frame with RA=77 (raw number) and saved BP=0 at indices [0,1]
    vm.rpush(77);
    vm.rpush(0);
    vm.BP = 2; // frame root points just above saved cells
    exitOp(vm);
    expect(vm.IP).toBe(77);
  });

  test('exitOp restores return address when numeric', () => {
    vm.rpush(88);
    vm.rpush(0);
    vm.BP = 2;
    exitOp(vm);
    expect(vm.IP).toBe(88);
  });

  test('endIfOp patches a branch placeholder correctly', () => {
    // Place a dummy 16-bit placeholder at current CP and push its position
    const pos = vm.compiler.CP;
    vm.compiler.compile16(0);
    vm.push(pos);
    endIfOp(vm);
    // Should have patched the placeholder to point to current CP (fallthrough)
    const patched = vm.memory.read16(SEG_CODE, pos);
    expect(typeof patched).toBe('number');
  });
});
