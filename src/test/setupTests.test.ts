describe('Jest Matchers', () => {
  describe('toBeCloseToArray', () => {
    it('should pass when arrays are equal within precision', () => {
      expect([1.234, 2.345, 3.456]).toBeCloseToArray([1.23, 2.34, 3.45], 2);
    });

    it('should fail when arrays have different lengths', () => {
      expect(() => {
        expect([1, 2, 3]).toBeCloseToArray([1, 2]);
      }).toThrow(/Expected arrays to have the same length/);
    });

    it('should fail when arrays are not close within precision', () => {
      expect(() => {
        expect([1.234, 2.345]).toBeCloseToArray([1.23, 2.35], 3);
      }).toThrow(/Arrays are not close to each other/);
    });

    it('should handle empty arrays', () => {
      expect([]).toBeCloseToArray([], 2);
    });

    it('should handle single-element arrays', () => {
      expect([1.234]).toBeCloseToArray([1.23], 2);
    });
  });
});
