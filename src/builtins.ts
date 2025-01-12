import { VM } from "./vm";
import { reset } from "./memory";
import { Verb } from "./types"; // Ensure Verb type is imported

export const leftBrace = (vm: VM) => {
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

export const rightBrace = (vm: VM) => {
  if (!vm.compiler.compileMode) {
    throw new Error("Unexpected '}' outside compilation mode");
  }

  // Decrement the nesting score
  vm.compiler.nestingScore--;

  if (vm.compiler.nestingScore === 0) {
    // Exit compilation mode and push the compiled block onto the stack
    vm.compiler.compile(vm.compiler.compileBuffer,exitDef);
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
export const literalNumber = (vm: VM) => {
  const num = vm.next();
  if (vm.compiler.compileMode) {
    vm.push(literalNumber);
    vm.push(num);
  } else {
    vm.push(num);
  }
};

/**
 * Internal function to signal the end of execution.
 */
export const exitDef = (vm: VM) => {
  vm.running = false;
};

export const immediateWords = [leftBrace, rightBrace, literalNumber];

/**
 * Built-in words for the interpreter.
 */
export const builtins: Record<string, Verb> = {
  "+": (vm: VM) => {
    const b = vm.pop();
    const a = vm.pop();
    if (typeof a === "number" && typeof b === "number") {
      vm.push(a + b);
    } else {
      throw new Error("Expected numbers on the stack");
    }
  },

  "-": (vm: VM) => {
    const b = vm.pop();
    const a = vm.pop();
    if (typeof a === "number" && typeof b === "number") {
      vm.push(a - b);
    } else {
      throw new Error("Expected numbers on the stack");
    }
  },

  "*": (vm: VM) => {
    const b = vm.pop();
    const a = vm.pop();
    if (typeof a === "number" && typeof b === "number") {
      vm.push(a * b);
    } else {
      throw new Error("Expected numbers on the stack");
    }
  },

  "/": (vm: VM) => {
    const b = vm.pop();
    const a = vm.pop();

    if (typeof a !== "number" || typeof b !== "number") {
      throw new Error("Expected numbers on the stack");
    }

    if (b === 0) {
      throw new Error("Division by zero");
    }

    vm.push(a / b);
  },

  dup: (vm: VM) => {
    const a = vm.pop();
    if (a !== undefined) {
      vm.push(a);
      vm.push(a);
    }
  },

  drop: (vm: VM) => {
    vm.pop();
  },

  swap: (vm: VM) => {
    const a = vm.pop();
    const b = vm.pop();
    if (a !== undefined && b !== undefined) {
      vm.push(a);
      vm.push(b);
    }
  },

  "{": leftBrace,
  "}": rightBrace,
};
