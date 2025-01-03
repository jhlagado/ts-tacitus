import { Stack, push, pop, peek } from "./stack";

/**
 * Built-in words for the Forth interpreter.
 */
export const builtins = {
  "+": (stack: Stack<number>) => {
    const b = pop(stack);
    const a = pop(stack);
    if (a !== undefined && b !== undefined) {
      push(stack, a + b);
    }
  },
  "-": (stack: Stack<number>) => {
    const b = pop(stack);
    const a = pop(stack);
    if (a !== undefined && b !== undefined) {
      push(stack, a - b);
    }
  },
  "*": (stack: Stack<number>) => {
    const b = pop(stack);
    const a = pop(stack);
    if (a !== undefined && b !== undefined) {
      push(stack, a * b);
    }
  },
  "/": (stack: Stack<number>) => {
    const b = pop(stack);
    const a = pop(stack);

    if (a === undefined || b === undefined) {
      throw new Error("Stack underflow");
    }

    if (b === 0) {
      throw new Error("Division by zero");
    }

    push(stack, a / b);
  },
  dup: (stack: Stack<number>) => {
    const a = peek(stack);
    if (a !== undefined) {
      push(stack, a);
    }
  },
  drop: (stack: Stack<number>) => {
    pop(stack);
  },
  swap: (stack: Stack<number>) => {
    const a = pop(stack);
    const b = pop(stack);
    if (a !== undefined && b !== undefined) {
      push(stack, a);
      push(stack, b);
    }
  },
};
