import { describe, test, expect, beforeEach } from '@jest/globals';
import { VM, createVM } from '../../../src/core/vm';
import { Memory } from '../../../src/core/memory';
import { Digest } from '../../../src/strings/digest';
import { STACK_BASE, RSTACK_BASE } from '../../../src/core/constants';

describe('VM Constructor Initialization', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('should initialize memory as a Memory instance', () => {
    expect(vm.memory).toBeInstanceOf(Memory);
  });

  test('should initialize IP to 0', () => {
    expect(vm.IP).toBe(0);
  });

  test('should initialize running to true', () => {
    expect(vm.running).toBe(true);
  });

  test('should initialize SP to STACK_BASE', () => {
    expect(vm.sp).toBe(STACK_BASE);
  });

  test('should initialize RSP (absolute cells) to RSTACK_BASE', () => {
    expect(vm.rsp).toBe(RSTACK_BASE);
  });

  test('should initialize BP (absolute cells) to RSTACK_BASE', () => {
    expect(vm.bp).toBe(RSTACK_BASE);
  });

  test('should initialize digest as a Digest instance', () => {
    expect(vm.digest).toBeInstanceOf(Digest);
  });

  test('should initialize debug to false', () => {
    expect(vm.debug).toBe(false);
  });

  test('should initialize listDepth to 0', () => {
    expect(vm.listDepth).toBe(0);
  });

  test('should initialize dictionary with builtins (head > 0)', () => {
    // Builtins are registered during VM construction, so head should be > 0
    expect(vm.head).toBeGreaterThan(0);
    expect(typeof vm.head).toBe('number');
  });

  test('should initialize compiler state after constructor call', () => {
    expect(vm.compiler).toBeDefined();
    expect(vm.compiler).toHaveProperty('CP', 0);
    expect(vm.compiler).toHaveProperty('BCP', 0);
    expect(vm.compiler).toHaveProperty('preserve', false);
  });
});
