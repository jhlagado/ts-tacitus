declare global {
  namespace jest {
    interface Matchers<R> {
      toBeCloseToArray(expected: number[], precision?: number): R;
    }
  }
}
export {};
