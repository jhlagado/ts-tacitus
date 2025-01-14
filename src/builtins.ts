import { VM } from "./vm";
import { Verb } from "./types";

export enum Op {
  LiteralNumber,
  BranchCall,
  Exit,
  Exec,
  Plus,
  Minus,
  Multiply,
  Divide,
  Dup,
  Drop,
  Swap,
}

export const opTable: Record<string, Op> = {
  literalNumber: Op.LiteralNumber,
  branch: Op.BranchCall, // Add Branch to the opTable
  exitDef: Op.Exit,
  "exec": Op.Exec,
  "+": Op.Plus,
  "-": Op.Minus,
  "*": Op.Multiply,
  "/": Op.Divide,
  dup: Op.Dup,
  drop: Op.Drop,
  swap: Op.Swap,
};

export const literalNumberOp: Verb = (vm: VM) => {
  const num = vm.next() as number;
  vm.push(num);
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

export const execOp: Verb = (vm: VM) => {
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

export const ops: Verb[] = [
  literalNumberOp,
  branchCallOp, // Add the branch function to the ops array
  exitOp,
  execOp,
  plusOp,
  minusOp,
  multiplyOp,
  divideOp,
  dupOp,
  dropOp,
  swapOp,
];
