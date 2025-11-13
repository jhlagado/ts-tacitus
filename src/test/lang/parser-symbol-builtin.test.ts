/**
 * @fileoverview Test for @symbol pushing Tag.CODE for built-ins
 *
 * Builtins are now stored as Tag.CODE (with value < 128) for unified dispatch.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createVM, type VM, Tag, getTaggedInfo } from '../../core';
import { executeTacitCode } from '../utils/vm-test-utils';

describe('@symbol Parser/Compiler Integration - Tag.CODE for builtins', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  describe('@symbol without eval (tagged values on stack)', () => {
    it('should push Tag.CODE for built-ins (unified dispatch)', () => {
      const stack = executeTacitCode(vm, '@add');
      expect(stack.length).toBe(1);

      const { tag, value } = getTaggedInfo(stack[stack.length - 1]);
      // Builtins are now stored as Tag.CODE with value < 128
      expect(tag).toBe(Tag.CODE);
      expect(value).toBeLessThan(128); // Stored directly, not X1516 encoded
    });
  });
});
