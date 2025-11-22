import { describe, test, expect, beforeEach } from '@jest/globals';
import { VM, createVM } from '../../../src/core/vm';
import { STACK_BASE, RSTACK_BASE } from '../../../src/core/constants';

describe('VM Constructor Initialization', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('should initialize memory buffers', () => {
    expect(vm.memory.buffer).toBeInstanceOf(Uint8Array);
    expect(vm.memory.dataView).toBeInstanceOf(DataView);
  });

  test('should initialize ip to 0', () => {
    expect(vm.ip).toBe(0);
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

  test('should initialize digest structure', () => {
    expect(typeof vm.compile.digest.SBP).toBe('number');
    expect(vm.compile.digest.SBP).toBeGreaterThanOrEqual(0);
  });

  test('should initialize debug to false', () => {
    expect(vm.debug).toBe(false);
  });

  test('should initialize listDepth to 0', () => {
    expect(vm.compile.listDepth).toBe(0);
  });

  test('should initialize dictionary with builtins (head > 0)', () => {
    // Builtins are registered during VM construction, so head should be > 0
    expect(vm.compile.head).toBeGreaterThan(0);
    expect(typeof vm.compile.head).toBe('number');
  });

  test('should initialize compiler state after constructor call', () => {
    expect(vm.compile).toBeDefined();
    expect(vm.compile).toHaveProperty('CP', 0);
    expect(vm.compile).toHaveProperty('BCP', 0);
    expect(vm.compile).toHaveProperty('preserve', false);
  });
});
