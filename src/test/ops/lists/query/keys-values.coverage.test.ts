import { VM, createVM } from '../../../../core';
import { Tagged, Tag, NIL } from '../../../../core';
import { push, pop, peek } from '../../../../core/vm';
import { keysOp, valuesOp } from '../../../../ops/lists/query-ops';

describe('keysOp/valuesOp branch coverage', () => {
  let vm: VM;
  beforeEach(() => {
    vm = createVM();
  });

  test('keysOp on empty list returns empty list header', () => {
    push(vm, Tagged(0, Tag.LIST));
    keysOp(vm);
    // After keysOp: should push original header then empty list header
    const top = pop(vm);
    expect(top).toBe(Tagged(0, Tag.LIST));
  });

  test('valuesOp on empty list returns empty list header', () => {
    push(vm, Tagged(0, Tag.LIST));
    valuesOp(vm);
    const top = pop(vm);
    expect(top).toBe(Tagged(0, Tag.LIST));
  });

  test('keysOp on odd slotCount returns NIL', () => {
    // Build a 3-slot list payload on stack: a b c LIST:3
    push(vm, 1);
    push(vm, 2);
    push(vm, 3);
    push(vm, Tagged(3, Tag.LIST));
    keysOp(vm);
    expect(peek(vm)).toBe(NIL);
  });

  test('valuesOp on odd slotCount returns NIL', () => {
    push(vm, 1);
    push(vm, 2);
    push(vm, 3);
    push(vm, Tagged(3, Tag.LIST));
    valuesOp(vm);
    expect(peek(vm)).toBe(NIL);
  });
});
