import { describe, test, expect, beforeEach } from '@jest/globals';
import { VM } from '../../core/vm';
import { slotsRoll } from '../../stack/slots';

describe('Debug slotsRoll', () => {
  let vm: VM;

  beforeEach(() => {
    vm = new VM();
  });

  test('slotsRoll with correct indexing for swap', () => {
    vm.push(10);
    vm.push(20);
    vm.push(30);

    console.log('Before slotsRoll:', vm.getStackData());

    slotsRoll(vm, 1, 2, 1);

    console.log('After slotsRoll(vm, 1, 2, 1):', vm.getStackData());

    const stack = vm.getStackData();

    expect(stack[0]).toBe(10);
    expect(stack[1]).toBe(30);
    expect(stack[2]).toBe(20);
  });

  test('trace slotsRoll step by step', () => {
    vm.push(10);
    vm.push(20);
    vm.push(30);

    console.log('Initial stack:', vm.getStackData());
    console.log('SP:', vm.SP, 'Stack length:', vm.getStackData().length);

    slotsRoll(vm, 0, 2, 1);
    console.log('Final stack:', vm.getStackData());
  });
});
