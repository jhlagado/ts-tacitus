import { VM } from "./vm";
import { Verb } from "./types";

export enum Op {
  LeftBrace = 0,
  RightBrace = 1,
  LiteralNumber = 2,
  BranchCall = 3,
  Exit = 4,
  Plus = 5,
  Minus = 6,
  Multiply = 7,
  Divide = 8,
  Dup = 9,
  Drop = 10,
  Swap = 11,
}

export const leftBraceOp: Verb = (vm: VM) => {
  vm.compiler.nestingScore++;
  vm.compiler.compileMode = true;
  vm.compiler.compile(Op.BranchCall);
  vm.push(vm.compiler.getPointer()); // Push the current address for later patching
  vm.compiler.compile(0); // Placeholder for the relative offset
};

export const rightBraceOp: Verb = (vm: VM) => {
  if (!vm.compiler.compileMode) {
    throw new Error("Unexpected '}' outside compilation mode");
  }
  vm.compiler.compile(Op.Exit);
  const branchAddress = vm.pop(); // Get the address of the branch instruction
  const endAddress = vm.compiler.getPointer();
  const offset = endAddress - (branchAddress + 1); // Calculate the relative offset
  vm.compiler.setPointer(branchAddress); // Move to the offset location
  vm.compiler.compile(offset); // Write the relative offset
  vm.compiler.setPointer(endAddress); // Restore the pointer
  console.log("rightBrace 2", vm.compiler.compileMode);
  vm.compiler.nestingScore--;
  if (vm.compiler.nestingScore === 0) {
    vm.compiler.compileMode = false;
  }
};

export const literalNumberOp: Verb = (vm: VM) => {
  const num = vm.next() as number;
  if (vm.compiler.compileMode) {
    vm.compiler.compile(Op.LiteralNumber);
    vm.compiler.compile(num);
  } else {
    vm.push(num);
  }
};

/**
 * Branch Call to a relative address in memory.
 * The offset is relative to the address after the branch instruction.
 * Puts return address on the data stack
 */
export const branchCallOp: Verb = (vm: VM) => {
  const offset = vm.next() as number; // Read the relative offset
  vm.push(vm.IP); // Push the current IP
  vm.IP += offset; // Adjust the IP by the offset
};

export const exitOp: Verb = (vm: VM) => {
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
  branch: Op.BranchCall, // Add Branch to the opTable
  exitDef: Op.Exit,
  "+": Op.Plus,
  "-": Op.Minus,
  "*": Op.Multiply,
  "/": Op.Divide,
  dup: Op.Dup,
  drop: Op.Drop,
  swap: Op.Swap,
};

export const immediateWords: number[] = [
  Op.LeftBrace,
  Op.RightBrace,
  Op.LiteralNumber,
];

export const ops: Verb[] = [
  leftBraceOp,
  rightBraceOp,
  literalNumberOp,
  branchCallOp, // Add the branch function to the ops array
  exitOp,
  plusOp,
  minusOp,
  multiplyOp,
  divideOp,
  dupOp,
  dropOp,
  swapOp,
];
