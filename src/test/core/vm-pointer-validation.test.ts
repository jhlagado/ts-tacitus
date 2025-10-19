import { VM } from '../../core';
import { STACK_SIZE, RSTACK_SIZE, CELL_SIZE } from '../../core';

describe('VM pointer validation', () => {
  let vm: VM;

  beforeEach(() => {
    vm = new VM();
  });

  test('SP setter rejects negative values', () => {
    expect(() => {
      vm.SP = -1;
    }).toThrow('SP set to invalid value');
  });

  test('SP setter rejects values beyond stack capacity', () => {
    const maxCells = STACK_SIZE / CELL_SIZE;
    expect(() => {
      vm.SP = maxCells + 1;
    }).toThrow('SP set to invalid value');
  });

  test('SP setter rejects non-integer values', () => {
    expect(() => {
      vm.SP = 0.5;
    }).toThrow('SP set to invalid value');
  });

  test('RSP setter rejects negative values', () => {
    expect(() => {
      vm.RSP = -1;
    }).toThrow('RSP set to invalid value');
  });

  test('BP setter rejects values beyond return stack depth', () => {
    const maxCells = RSTACK_SIZE / CELL_SIZE;
    expect(() => {
      vm.BP = maxCells + 1;
    }).toThrow('BP (cells) set to invalid value');
  });

  test('GP setter rejects negative values', () => {
    expect(() => {
      vm.GP = -1;
    }).toThrow('GP set to invalid value');
  });

  test('unsafeSetBPBytes rejects non-aligned offsets', () => {
    expect(() => vm.unsafeSetBPBytes(2)).toThrow('unsafeSetBPBytes: non-cell-aligned value 2');
  });

  test('ensureInvariants catches negative stack pointers', () => {
    vm.debug = true;
    // Force invalid internal state and run invariant check
    (vm as unknown as { _spCells: number })._spCells = -1;
    expect(() => vm.ensureInvariants()).toThrow('Invariant violation: negative stack pointer');
  });
});
