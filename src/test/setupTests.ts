import 'jest';
expect.extend({
  toBeCloseToArray(received: number[], expected: number[], precision = 2) {
    if (!Array.isArray(received) || !Array.isArray(expected)) {
      return {
        pass: false,
        message: () => `Expected both received and expected to be arrays.`,
      };
    }
    if (received.length !== expected.length) {
      return {
        pass: false,
        message: () =>
          `Expected arrays to have the same length. Received: ${received.length}, Expected: ${expected.length}`,
      };
    }
    const pass = received.every(
      (value, index) => Math.abs(value - expected[index]) < Math.pow(10, -precision),
    );
    return {
      pass,
      message: () =>
        pass
          ? `Arrays are close to each other within precision ${precision}.`
          : `Arrays are not close to each other. Received: ${received}, Expected: ${expected}`,
    };
  },
});
