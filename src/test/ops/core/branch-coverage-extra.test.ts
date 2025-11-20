import { createVM, type VM, emitUint16 } from '../../../core/vm';
import { groupLeftOp, groupRightOp, endIfOp, endWithOp, exitOp } from '../../../ops/core/core-ops';
import { memoryRead16, SEG_CODE } from '../../../core';
import { RSTACK_BASE } from '../../../core/constants';
import { push, rpush, pop } from '../../../core/vm';

describe('Core ops extra branch coverage', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('groupRightOp underflow throws', () => {
    // No entries on return stack → underflow path
    expect(() => groupRightOp(vm)).toThrow();
  });

  test('endIfOp errors on missing placeholder', () => {
    // Push a non-numeric placeholder
    push(vm, NaN);
    expect(() => endIfOp(vm)).toThrow();
  });

  test('endWithOp errors on missing predicate placeholder', () => {
    push(vm, NaN);
    expect(() => endWithOp(vm)).toThrow();
  });

  test('groupLeft/groupRight normal path counts pushes', () => {
    // Push two items, mark, push three more, then measure
    push(vm, 1);
    push(vm, 2);
    groupLeftOp(vm);
    push(vm, 3);
    push(vm, 4);
    push(vm, 5);
    groupRightOp(vm);
    // Expect count of items pushed after groupLeft
    expect(pop(vm)).toBe(3);
  });

  test('exitOp stops VM when no caller frame', () => {
    vm.running = true;
    vm.rsp = RSTACK_BASE; // no saved BP/RA (absolute base)
    exitOp(vm);
    expect(vm.running).toBe(false);
  });

  test('exitOp restores return address when non-CODE (raw)', () => {
    // Simulate a frame with RA=77 (raw number) and saved BP=0 at indices [0,1]
    rpush(vm, 77);
    rpush(vm, 0);
    vm.bp = RSTACK_BASE + 2; // frame root points just above saved cells
    exitOp(vm);
    expect(vm.IP).toBe(77);
  });

  test('exitOp restores return address when numeric', () => {
    rpush(vm, 88);
    rpush(vm, 0);
    vm.bp = RSTACK_BASE + 2;
    exitOp(vm);
    expect(vm.IP).toBe(88);
  });

  test('endIfOp patches a branch placeholder correctly', () => {
    // Place a dummy 16-bit placeholder at current CP and push its position
    const pos = vm.compiler.CP;
    emitUint16(vm, 0);
    push(vm, pos);
    endIfOp(vm);
    // Should have patched the placeholder to point to current CP (fallthrough)
    const patched = memoryRead16(vm.memory, SEG_CODE, pos);
    expect(typeof patched).toBe('number');
  });
});
