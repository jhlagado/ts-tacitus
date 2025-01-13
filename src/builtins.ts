// src/builtins.ts

import { VM } from "./vm";
import { Verb } from "./types";
import { CODE } from "./constants";

// Define the Op enum
export enum Op {
  LeftBrace = 0, // {
  RightBrace = 1, // }
  LiteralNumber = 2, // literalNumber
  ExitDef = 3, // exitDef
  PlusOp = 4, // +
  MinusOp = 5, // -
  MultiplyOp = 6, // *
  DivideOp = 7, // /
  DupOp = 8, // dup
  DropOp = 9, // drop
  SwapOp = 10, // swap
}

// Define all built-in words as functions

// 1. Compilation words
export const leftBrace: Verb = (vm: VM) => {
  if (vm.compiler.compileMode) {
    vm.compiler.compileCode(Op.LeftBrace);
  } else {
    vm.compiler.compileMode = true;
    vm.compiler.CP = CODE;
  }
  vm.compiler.nestingScore++;
};

export const rightBrace: Verb = (vm: VM) => {
  if (!vm.compiler.compileMode) {
    throw new Error("Unexpected '}' outside compilation mode");
  }
  vm.compiler.nestingScore--;
  if (vm.compiler.nestingScore === 0) {
    vm.compiler.compileCode(Op.ExitDef);
    vm.compiler.compileMode = false;
    vm.push(vm.compiler.CP);
  } else {
    vm.compiler.compileCode(Op.RightBrace);
  }
};

export const literalNumber: Verb = (vm: VM) => {
  const num = vm.next() as number;
  if (vm.compiler.compileMode) {
    vm.compiler.compileCode(Op.LiteralNumber);
    vm.compiler.compileCode(num);
  } else {
    vm.push(num);
  }
};

export const exitDef: Verb = (vm: VM) => {
  vm.running = false;
};

// 2. Arithmetic words
export const plusOp: Verb = (vm: VM) => {
  const b = vm.pop();
  const a = vm.pop();
  if (typeof a === "number" && typeof b === "number") {
    vm.push(a + b);
  } else {
    throw new Error("Expected numbers on the stack");
  }
};

export const minusOp: Verb = (vm: VM) => {
  const b = vm.pop();
  const a = vm.pop();
  if (typeof a === "number" && typeof b === "number") {
    vm.push(a - b);
  } else {
    throw new Error("Expected numbers on the stack");
  }
};

export const multiplyOp: Verb = (vm: VM) => {
  const b = vm.pop();
  const a = vm.pop();
  if (typeof a === "number" && typeof b === "number") {
    vm.push(a * b);
  } else {
    throw new Error("Expected numbers on the stack");
  }
};

export const divideOp: Verb = (vm: VM) => {
  const b = vm.pop();
  const a = vm.pop();
  if (typeof a !== "number" || typeof b !== "number") {
    throw new Error("Expected numbers on the stack");
  }
  if (b === 0) {
    throw new Error("Division by zero");
  }
  vm.push(a / b);
};

// 3. Stack manipulation words
export const dupOp: Verb = (vm: VM) => {
  const a = vm.pop();
  if (a !== undefined) {
    vm.push(a);
    vm.push(a);
  }
};

export const dropOp: Verb = (vm: VM) => {
  vm.pop();
};

export const swapOp: Verb = (vm: VM) => {
  const a = vm.pop();
  const b = vm.pop();
  if (a !== undefined && b !== undefined) {
    vm.push(a);
    vm.push(b);
  }
};

// Define the opTable
export const opTable: Record<string, Op> = {
  "{": Op.LeftBrace,
  "}": Op.RightBrace,
  literalNumber: Op.LiteralNumber,
  exitDef: Op.ExitDef,
  "+": Op.PlusOp,
  "-": Op.MinusOp,
  "*": Op.MultiplyOp,
  "/": Op.DivideOp,
  dup: Op.DupOp,
  drop: Op.DropOp,
  swap: Op.SwapOp,
};

// Define immediate words using Op enum values
export const immediateWords: number[] = [
  Op.LeftBrace, // {
  Op.RightBrace, // }
  Op.LiteralNumber, // literalNumber
];

export const ops: Verb[] = [
  leftBrace,
  rightBrace,
  literalNumber,
  exitDef,
  plusOp,
  minusOp,
  multiplyOp,
  divideOp,
  dupOp,
  dropOp,
  swapOp,
];
