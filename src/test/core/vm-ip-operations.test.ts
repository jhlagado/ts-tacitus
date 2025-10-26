import { describe, test, expect, beforeEach } from '@jest/globals';
import { SEG_CODE, toTaggedValue, Tag } from '../../core';
import { Op } from '../../ops/opcodes';
import { initializeInterpreter, vm } from '../../lang/runtime';

const CELL_SIZE = 4;

describe('VM Instruction Pointer Operations', () => {
  beforeEach(() => {
    initializeInterpreter();
    vm.debug = false;
    vm.IP = 0; // Ensure IP starts at 0 for each test
    vm.compiler.CP = 0; // Reset compiler pointer for clean bytecode writing
  });

  test('next8 should read a byte and advance IP by 1', () => {
    vm.memory.write8(SEG_CODE, 0, 0xab);
    const value = vm.next8();
    expect(value).toBe(0xab);
    expect(vm.IP).toBe(1);
  });

  test('nextOpcode should read a single-byte opcode and advance IP by 1', () => {
    vm.memory.write8(SEG_CODE, 0, Op.Add);
    const opcode = vm.nextOpcode();
    expect(opcode).toBe(Op.Add);
    expect(vm.IP).toBe(1);
  });

  test('nextOpcode should read a two-byte opcode and advance IP by 2', () => {
    const twoByteOpcode = Op.Add + 128; // Simulate a user-defined opcode
    vm.memory.write8(SEG_CODE, 0, 0x80 | (twoByteOpcode & 0x7f));
    vm.memory.write8(SEG_CODE, 1, (twoByteOpcode >> 7) & 0xff);
    const opcode = vm.nextOpcode();
    expect(opcode).toBe(twoByteOpcode);
    expect(vm.IP).toBe(2);
  });

  test('nextInt16 should read a 16-bit signed integer and advance IP by 2', () => {
    vm.memory.write16(SEG_CODE, 0, -12345);
    const value = vm.nextInt16();
    expect(value).toBe(-12345);
    expect(vm.IP).toBe(2);
  });

  test('nextFloat32 should read a 32-bit float and advance IP by CELL_SIZE', () => {
    vm.memory.writeFloat32(SEG_CODE, 0, 3.14159);
    const value = vm.nextFloat32();
    expect(value).toBeCloseTo(3.14159);
    expect(vm.IP).toBe(CELL_SIZE);
  });

  test('nextAddress should read a tagged address and advance IP by CELL_SIZE', () => {
    const testAddress = 0x1234;
    vm.memory.writeFloat32(SEG_CODE, 0, toTaggedValue(testAddress, Tag.CODE));
    const address = vm.nextAddress();
    expect(address).toBe(testAddress);
    expect(vm.IP).toBe(CELL_SIZE);
  });

  test('nextUint16 should read a 16-bit unsigned integer and advance IP by 2', () => {
    vm.memory.write16(SEG_CODE, 0, 65535);
    const value = vm.nextUint16();
    expect(value).toBe(65535);
    expect(vm.IP).toBe(2);
  });

  test('IP should advance correctly across mixed reads', () => {
    vm.memory.write8(SEG_CODE, 0, 0x01); // next8
    vm.memory.write16(SEG_CODE, 1, 0x0203); // nextInt16
    vm.memory.writeFloat32(SEG_CODE, 3, 3.14); // nextFloat32

    vm.next8();
    expect(vm.IP).toBe(1);

    vm.nextInt16();
    expect(vm.IP).toBe(3);

    vm.nextFloat32();
    expect(vm.IP).toBe(7);
  });
});
