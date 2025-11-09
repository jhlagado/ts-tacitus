/**
 * @fileoverview Test for @symbol pushing Tag.BUILTIN for built-ins
 * 
 * This test is isolated due to a failure that needs investigation.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createVM, type VM, Tag, fromTaggedValue } from '../../core';
import { executeTacitCode } from '../utils/vm-test-utils';

describe('@symbol Parser/Compiler Integration - Tag.BUILTIN', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  describe('@symbol without eval (tagged values on stack)', () => {
    it('should push Tag.BUILTIN for built-ins', () => {
      const stack = executeTacitCode(vm, '@add');
      expect(stack.length).toBe(1);

      const { tag } = fromTaggedValue(stack[stack.length - 1]);
      expect(tag).toBe(Tag.BUILTIN);
    });
  });
});

