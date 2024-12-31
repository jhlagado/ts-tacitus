export type Stack<T> = T[];

/**
 * Creates a new stack.
 * @returns A new stack.
 */
export function createStack<T>(): Stack<T> {
  return [];
}

/**
 * Pushes an item onto the stack.
 * @param stack - The stack to push the item onto.
 * @param item - The item to push.
 */
export function push<T>(stack: Stack<T>, item: T): void {
  stack.push(item);
}

/**
 * Pops an item from the stack.
 * @param stack - The stack to pop the item from.
 * @returns The popped item, or undefined if the stack is empty.
 */
export function pop<T>(stack: Stack<T>): T | undefined {
    if (stack.length === 0) {
        throw new Error("Stack underflow");
    }
    return stack.pop();
}

/**
 * Peeks at the top item of the stack without removing it.
 * @param stack - The stack to peek at.
 * @returns The top item, or undefined if the stack is empty.
 */
export function peek<T>(stack: Stack<T>): T | undefined {
  return stack[stack.length - 1];
}

/**
 * Gets the size of the stack.
 * @param stack - The stack to get the size of.
 * @returns The size of the stack.
 */
export function size<T>(stack: Stack<T>): number {
  return stack.length;
}

/**
 * Clears the stack.
 * @param stack - The stack to clear.
 */
export function clear<T>(stack: Stack<T>): void {
  stack.length = 0;
}

/**
 * Gets all items in the stack.
 * @param stack - The stack to get the items from.
 * @returns An array of all items in the stack.
 */
export function getItems<T>(stack: Stack<T>): T[] {
  return stack;
}