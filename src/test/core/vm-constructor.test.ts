import { describe, test, expect, beforeEach } from '@jest/globals';
import { VM } from '../../../src/core/vm';
import { Memory } from '../../../src/core/memory';
import { Digest } from '../../../src/strings/digest';
import { SymbolTable } from '../../../src/strings/symbol-table';
import { NIL } from '../../../src/core/tagged';
import { Compiler } from '../../../src/lang/compiler';

describe('VM Constructor Initialization', () => {
  let vm: VM;

  beforeEach(() => {
    vm = new VM();
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

  test('should initialize SP to 0', () => {
    expect(vm.SP).toBe(0);
  });

  test('should initialize RP to 0', () => {
    expect(vm.RP).toBe(0);
  });

  test('should initialize BP to 0', () => {
    expect(vm.BP).toBe(0);
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

  test('should initialize receiver to 0', () => {
    expect(vm.receiver).toBe(0);
  });

  test('should initialize symbolTable as a SymbolTable instance', () => {
    expect(vm.symbolTable).toBeInstanceOf(SymbolTable);
  });

  test('should initialize tempRegister to NIL', () => {
    expect(vm.tempRegister).toBe(NIL);
  });

  test('should initialize compiler property after constructor call', () => {
    // The compiler is initialized by initializeInterpreter, which is called globally
    // or explicitly after VM construction. So, it won't be set directly in the constructor.
    // We need to simulate the initialization process.
    const compiler = new Compiler(vm);
    vm.initializeCompiler(compiler);
    expect(vm.compiler).toBeInstanceOf(Compiler);
  });
});
