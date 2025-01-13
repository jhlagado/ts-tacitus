import { VM } from "./vm";
import { Verb } from "./types";

export enum Op {
  LeftBrace = 0,
  RightBrace = 1,
  LiteralNumber = 2,
  Branch = 3, 
  ExitDef = 4,
  PlusOp = 5,
  MinusOp = 6,
  MultiplyOp = 7,
  DivideOp = 8,
  DupOp = 9,
  DropOp = 10,
  SwapOp = 11,
}

export const leftBrace: Verb = (vm: VM) => {
  vm.compiler.nestingScore++;
  if (vm.compiler.compileMode) {
    vm.compiler.compile(Op.LeftBrace);
    return;
  }
  vm.compiler.compileMode = true;
  vm.compiler.compile(Op.Branch);
  vm.push(vm.compiler.getPointer());
  vm.compiler.compile(0);
};

export const rightBrace: Verb = (vm: VM) => {
  if (!vm.compiler.compileMode) {
    throw new Error("Unexpected '}' outside compilation mode");
  }
  vm.compiler.compile(Op.ExitDef);
  const endAddress = vm.compiler.getPointer();
  vm.compiler.setPointer(vm.pop());
  vm.compiler.compile(endAddress);
  vm.push(vm.compiler.getPointer());
  vm.compiler.setPointer(endAddress);
  vm.compiler.nestingScore--;
  if (vm.compiler.nestingScore === 0){
    vm.compiler.compileMode = false;
  }
};

export const literalNumber: Verb = (vm: VM) => {
  const num = vm.next() as number;
  if (vm.compiler.compileMode) {
    vm.compiler.compile(Op.LiteralNumber);
    vm.compiler.compile(num);
  } else {
    vm.push(num);
  }
};

/**
 * Branch to a specific address in memory.
 * The address is the next value in memory after the Branch opcode.
 */
export const branch: Verb = (vm: VM) => {
  const address = vm.next() as number; // Read the address to branch to
  vm.IP = address; // Set the instruction pointer to the new address
};

export const exitDef: Verb = (vm: VM) => {
  vm.running = false;
};

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

export const opTable: Record<string, Op> = {
  "{": Op.LeftBrace,
  "}": Op.RightBrace,
  literalNumber: Op.LiteralNumber,
  branch: Op.Branch, // Add Branch to the opTable
  exitDef: Op.ExitDef,
  "+": Op.PlusOp,
  "-": Op.MinusOp,
  "*": Op.MultiplyOp,
  "/": Op.DivideOp,
  dup: Op.DupOp,
  drop: Op.DropOp,
  swap: Op.SwapOp,
};

export const immediateWords: number[] = [
  Op.LeftBrace,
  Op.RightBrace,
  Op.LiteralNumber,
];

export const ops: Verb[] = [
  leftBrace,
  rightBrace,
  literalNumber,
  branch, // Add the branch function to the ops array
  exitDef,
  plusOp,
  minusOp,
  multiplyOp,
  divideOp,
  dupOp,
  dropOp,
  swapOp,
];
