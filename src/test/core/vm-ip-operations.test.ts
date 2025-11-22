import { describe, test, expect, beforeEach } from '@jest/globals';
import { SEG_CODE, Tagged, Tag, memoryWrite8, memoryWrite16, memoryWriteFloat32 } from '../../core';
import { encodeX1516 } from '../../core/code-ref';
import { Op } from '../../ops/opcodes';
import { createVM, type VM } from '../../core/vm';
import { nextAddress, next8, nextOpcode, nextInt16, nextFloat32, nextUint16 } from '../../core/vm';

const CELL_SIZE = 4;

describe('VM Instruction Pointer Operations', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
    vm.debug = false;
    vm.ip = 0; // Ensure ip starts at 0 for each test
    vm.compiler.CP = 0; // Reset compiler pointer for clean bytecode writing
  });

  test('next8 should read a byte and advance ip by 1', () => {
    memoryWrite8(vm.memory, SEG_CODE, 0, 0xab);
    const value = next8(vm);
    expect(value).toBe(0xab);
    expect(vm.ip).toBe(1);
  });

  test('nextOpcode should read a single-byte opcode and advance ip by 1', () => {
    memoryWrite8(vm.memory, SEG_CODE, 0, Op.Add);
    const opcode = nextOpcode(vm);
    expect(opcode).toBe(Op.Add);
    expect(vm.ip).toBe(1);
  });

  test('nextOpcode should read a two-byte opcode and advance ip by 2', () => {
    const twoByteOpcode = Op.Add + 128; // Simulate a user-defined opcode
    memoryWrite8(vm.memory, SEG_CODE, 0, 0x80 | (twoByteOpcode & 0x7f));
    memoryWrite8(vm.memory, SEG_CODE, 1, (twoByteOpcode >> 7) & 0xff);
    const opcode = nextOpcode(vm);
    expect(opcode).toBe(twoByteOpcode);
    expect(vm.ip).toBe(2);
  });

  test('nextInt16 should read a 16-bit signed integer and advance ip by 2', () => {
    memoryWrite16(vm.memory, SEG_CODE, 0, -12345);
    const value = nextInt16(vm);
    expect(value).toBe(-12345);
    expect(vm.ip).toBe(2);
  });

  test('nextFloat32 should read a 32-bit float and advance ip by CELL_SIZE', () => {
    memoryWriteFloat32(vm.memory, SEG_CODE, 0, 3.14159);
    const value = nextFloat32(vm);
    expect(value).toBeCloseTo(3.14159);
    expect(vm.ip).toBe(CELL_SIZE);
  });

  test('nextAddress should read a tagged address and advance ip by CELL_SIZE', () => {
    const testAddress = 0x1234;
    memoryWriteFloat32(vm.memory, SEG_CODE, 0, Tagged(encodeX1516(testAddress), Tag.CODE));
    const address = nextAddress(vm);
    expect(address).toBe(testAddress); // nextAddress decodes the X1516 value
    expect(vm.ip).toBe(CELL_SIZE);
  });

  test('nextUint16 should read a 16-bit unsigned integer and advance ip by 2', () => {
    memoryWrite16(vm.memory, SEG_CODE, 0, 65535);
    const value = nextUint16(vm);
    expect(value).toBe(65535);
    expect(vm.ip).toBe(2);
  });

  test('ip should advance correctly across mixed reads', () => {
    memoryWrite8(vm.memory, SEG_CODE, 0, 0x01); // next8
    memoryWrite16(vm.memory, SEG_CODE, 1, 0x0203); // nextInt16
    memoryWriteFloat32(vm.memory, SEG_CODE, 3, 3.14); // nextFloat32

    next8(vm);
    expect(vm.ip).toBe(1);

    nextInt16(vm);
    expect(vm.ip).toBe(3);

    nextFloat32(vm);
    expect(vm.ip).toBe(7);
  });
});
