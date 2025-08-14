import { VM } from '../../../core/vm';
import { Op } from '../../../ops/opcodes';
import { NIL, toTaggedValue, Tag } from '../../../core/tagged';
import { executeOp } from '../../../ops/builtins';

describe('Temp Register Opcodes', () => {
  let vm: VM;

  beforeEach(() => {
    vm = new VM();
  });

  it('saveTempOp should pop stack and store in tempRegister', () => {
    const value = toTaggedValue(42, Tag.NUMBER);
    vm.push(value);
    executeOp(vm, Op.SaveTemp);
    expect(vm.tempRegister).toBe(value);
    expect(vm.SP).toBe(0);
  });

  it('restoreTempOp should push tempRegister onto stack', () => {
    const value = toTaggedValue(99, Tag.NUMBER);
    vm.tempRegister = value;
    executeOp(vm, Op.RestoreTemp);
    expect(vm.pop()).toBe(value);
    expect(vm.tempRegister).toBe(value);
  });

  it('saveTempOp and restoreTempOp work together', () => {
    const value = toTaggedValue(123, Tag.NUMBER);
    vm.push(value);
    executeOp(vm, Op.SaveTemp);
    expect(vm.tempRegister).toBe(value);
    expect(vm.SP).toBe(0);
    executeOp(vm, Op.RestoreTemp);
    expect(vm.pop()).toBe(value);
  });

  it('restoreTempOp pushes NIL if tempRegister is NIL', () => {
    vm.tempRegister = NIL;
    executeOp(vm, Op.RestoreTemp);
    expect(vm.pop()).toBe(NIL);
  });

  it('saveTempOp throws if stack is empty', () => {
    expect(() => executeOp(vm, Op.SaveTemp)).toThrow();
  });
});
