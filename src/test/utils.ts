/**
 * Compares two arrays element-wise using toBeCloseTo for floating-point precision.
 *
 * @param received The received array.
 * @param expected The expected array.
 * @param precision The number of decimal places to check for closeness.
 */

export function toBeCloseToArray(received: number[], expected: number[], precision = 2): void {
  if (received.length !== expected.length) {
    throw new Error(
      `Arrays have different lengths: received ${received.length}, expected ${expected.length}`,
    );
  }

  for (let i = 0; i < received.length; i++) {
    if (Math.abs(received[i] - expected[i]) > Math.pow(10, -precision)) {
      throw new Error(
        `Array elements at index ${i} differ: received ${received[i]}, expected ${expected[i]}`,
      );
    }
  }
}
