/**
 * @file src/stack/types.ts
 *
 * This file defines type definitions used throughout the stack manipulation module.
 *
 * The stack module provides utilities for working with the Tacit VM's stack,
 * including finding elements, manipulating ranges of slots, and handling
 * complex data structures like lists.
 */

/**
 * Type representing information about a stack argument.
 *
 * This is a tuple containing two numbers:
 * - The first number represents the offset to the next element after the current one
 * - The second number represents the size of the current element in slots
 *
 * This type is used by stack navigation functions to track element positions and sizes,
 * which is especially important when dealing with complex structures like lists
 * that occupy multiple slots on the stack.
 *
 * @example
 *
 * const info: StackArgInfo = [1, 1];
 *
 * @example
 *
 * const info: StackArgInfo = [5, 5];
 */
export type StackArgInfo = [number, number];
