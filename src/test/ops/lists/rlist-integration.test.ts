import { describe, it, expect, beforeEach } from '@jest/globals';
import { initializeInterpreter, vm } from '../../../core/globalState';
import { executeProgram } from '../../../lang/interpreter';
import { fromTaggedValue, Tag } from '../../../core/tagged';

describe('RLIST Integration Tests', () => {
  beforeEach(() => {
    initializeInterpreter();
  });

  describe('parser + VM integration', () => {
    it('should build a simple RLIST using [ ] syntax', () => {
      executeProgram('[ 1 2 3 ]');
      const stack = vm.getStackData();
      expect(stack.length).toBe(4);

      const header = stack[stack.length - 1];
      const { tag: headerTag, value: slots } = fromTaggedValue(header);
      expect(headerTag).toBe(Tag.RLIST);
      expect(slots).toBe(3);

      const payload0 = stack[stack.length - 2];
      const payload1 = stack[stack.length - 3];
      const payload2 = stack[stack.length - 4];

      expect(fromTaggedValue(payload0)).toEqual({ tag: Tag.NUMBER, value: 1 });
      expect(fromTaggedValue(payload1)).toEqual({ tag: Tag.NUMBER, value: 2 });
      expect(fromTaggedValue(payload2)).toEqual({ tag: Tag.NUMBER, value: 3 });
    });

    it('should build nested RLISTs correctly', () => {
      executeProgram('[ 1 [ 2 3 ] 4 ]');
      const stack = vm.getStackData();

      // Expect: payload plus two RLIST headers (inner and outer)
      // Layout from bottom to top: [4 payload elements including inner rlist payload/header] [outer header]
      const outerHeader = stack[stack.length - 1];
      const { tag: outerTag, value: outerSlots } = fromTaggedValue(outerHeader);
      expect(outerTag).toBe(Tag.RLIST);
      // Outer slots should count its payload cells including inner RLIST header and its payload
      expect(outerSlots).toBeGreaterThan(0);

      // The immediate cell below the outer header should be first logical element (1)
      const firstLogical = stack[stack.length - 2];
      expect(fromTaggedValue(firstLogical)).toEqual({ tag: Tag.NUMBER, value: 1 });

      // Somewhere below should be the inner RLIST header
      const innerHeaderIndex = stack.findIndex((v, i) => {
        if (i >= stack.length - 1) return false;
        const d = fromTaggedValue(v);
        return d.tag === Tag.RLIST && i !== stack.length - 1;
      });
      expect(innerHeaderIndex).toBeGreaterThanOrEqual(0);
      const { tag: innerTag, value: innerSlots } = fromTaggedValue(stack[innerHeaderIndex]);
      expect(innerTag).toBe(Tag.RLIST);
      expect(innerSlots).toBe(2);
    });
  });

  describe('memory layout validation', () => {
    it('should keep RLIST payload contiguous in memory', () => {
      executeProgram('[ 10 20 30 40 ]');
      const stack = vm.getStackData();
      // Verify contiguous payload cells immediately under header
      const values = [
        stack[stack.length - 2],
        stack[stack.length - 3],
        stack[stack.length - 4],
        stack[stack.length - 5],
      ].map((v) => fromTaggedValue(v).value);
      expect(values).toEqual([10, 20, 30, 40]);
    });
  });
});
