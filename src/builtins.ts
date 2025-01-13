import { VM } from "./vm";
import { reset } from "./memory";
import { Verb } from "./types"; // Ensure Verb type is imported

export const leftBrace: Verb = (vm: VM) => {
  if (vm.compiler.compileMode) {
    // If already in compile mode, treat "{" as a regular word
    vm.compiler.compile(vm.compiler.compileBuffer, builtins["{"]);
  } else {
    // Enter compilation mode
    vm.compiler.compileMode = true;
    reset(vm.compiler.compileBuffer);
  }
  vm.compiler.nestingScore++;
};

export const rightBrace: Verb = (vm: VM) => {
  if (!vm.compiler.compileMode) {
    throw new Error("Unexpected '}' outside compilation mode");
  }

  // Decrement the nesting score
  vm.compiler.nestingScore--;

  if (vm.compiler.nestingScore === 0) {
    // Exit compilation mode and push the compiled block onto the stack
    vm.compiler.compile(vm.compiler.compileBuffer, exitDef);
    vm.compiler.compileMode = false;
    vm.push(vm.compiler.compileBuffer.base);
  } else {
    // If still in a nested block, treat "}" as a regular word
    vm.compiler.compile(vm.compiler.compileBuffer, builtins["}"]);
  }
};

/**
 * Internal function to handle literal numbers.
 */
export const literalNumber: Verb = (vm: VM) => {
  const num = vm.next() as number;
  if (vm.compiler.compileMode) {
    vm.compiler.compile(vm.compiler.compileBuffer, literalNumber);
    vm.compiler.compile(vm.compiler.compileBuffer, num);
  } else {
    vm.push(num);
  }
};

/**
 * Internal function to signal the end of execution.
 */
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

export const immediateWords = [leftBrace, rightBrace, literalNumber];

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

export const opTable: Record<string, number> = {
  "{": 0,
  "}": 1,
  literalNumber: 2,
  exitDef: 3,
  "+": 4,
  "-": 5,
  "*": 6,
  "/": 7,
  dup: 8,
  drop: 9,
  swap: 10,
};

/**
 * Built-in words for the interpreter.
 */
export const builtins: Record<string, Verb> = {
  "{": leftBrace,
  "}": rightBrace,
  literalNumber: literalNumber,
  exitDef: exitDef,
  "+": plusOp,
  "-": minusOp,
  "*": multiplyOp,
  "/": divideOp,
  dup: dupOp,
  drop: dropOp,
  swap: swapOp,
};
