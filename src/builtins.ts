import { vm } from "./globalState";
import { next, pop, push, reset } from "./memory";
import { Verb } from "./types";

export const leftBrace = () => {
  if (vm.compileMode) {
    // If already in compile mode, treat "{" as a regular word
    push(vm.compileBuffer, builtins["{"]);
  } else {
    // Enter compilation mode
    vm.compileMode = true;
    reset(vm.compileBuffer);
  }
  vm.nestingScore++;
};

export const rightBrace = () => {
  if (!vm.compileMode) {
    throw new Error("Unexpected '}' outside compilation mode");
  }

  // Decrement the nesting score
  vm.nestingScore--;

  if (vm.nestingScore === 0) {
    // Exit compilation mode and push the compiled block onto the stack
    push(vm.compileBuffer, exitDef);
    vm.compileMode = false;
    push(vm.stack, vm.compileBuffer.base);
  } else {
    // If still in a nested block, treat "}" as a regular word
    push(vm.compileBuffer, builtins["}"]);
  }
};

/**
 * Internal function to handle literal numbers.
 * Implementation is left empty for now.
 */
export const literalNumber = () => {
  const num = next(vm.IP);
  if (vm.compileMode) {
    push(vm.compileBuffer, literalNumber);
    push(vm.compileBuffer, num);
  } else {
    push(vm.stack, num);
  }
};

/**
 * Internal function to signal the end of execution.
 * For now, this is empty. It will be used to control the IP later.
 */
export const exitDef = () => {
  vm.running = false;
  // Implementation will be added later
};

export const immediateWords = [leftBrace, rightBrace, literalNumber];

/**
 * Built-in words for the interpreter.
 */
export const builtins: Record<string, Verb> = {
  "+": () => {
    const b = pop(vm.stack);
    const a = pop(vm.stack);
    if (typeof a === "number" && typeof b === "number") {
      push(vm.stack, a + b);
    } else {
      throw new Error("Expected numbers on the stack");
    }
  },

  "-": () => {
    const b = pop(vm.stack);
    const a = pop(vm.stack);
    if (typeof a === "number" && typeof b === "number") {
      push(vm.stack, a - b);
    } else {
      throw new Error("Expected numbers on the stack");
    }
  },

  "*": () => {
    const b = pop(vm.stack);
    const a = pop(vm.stack);
    if (typeof a === "number" && typeof b === "number") {
      push(vm.stack, a * b);
    } else {
      throw new Error("Expected numbers on the stack");
    }
  },

  "/": () => {
    const b = pop(vm.stack);
    const a = pop(vm.stack);

    if (typeof a !== "number" || typeof b !== "number") {
      throw new Error("Expected numbers on the stack");
    }

    if (b === 0) {
      throw new Error("Division by zero");
    }

    push(vm.stack, a / b);
  },

  dup: () => {
    const a = pop(vm.stack);
    if (a !== undefined) {
      push(vm.stack, a);
      push(vm.stack, a);
    }
  },

  drop: () => {
    pop(vm.stack);
  },

  swap: () => {
    const a = pop(vm.stack);
    const b = pop(vm.stack);
    if (a !== undefined && b !== undefined) {
      push(vm.stack, a);
      push(vm.stack, b);
    }
  },

  "{": leftBrace,
  "}": rightBrace,
};
