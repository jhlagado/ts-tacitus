/**
 * @fileoverview Test for @symbol pushing Tag.CODE for colon definitions
 *
 * This test is isolated due to a failure that needs investigation.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createVM, type VM, Tag, getTaggedInfo } from '../../core';
import { executeTacitCode } from '../utils/vm-test-utils';

describe('@symbol Parser/Compiler Integration - Tag.CODE', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  describe('@symbol without eval (tagged values on stack)', () => {
    it('should push Tag.CODE for colon definitions', () => {
      const stack = executeTacitCode(vm, ': test 42 ; @test');
      expect(stack.length).toBe(1);

      const { tag } = getTaggedInfo(stack[stack.length - 1]);
      expect(tag).toBe(Tag.CODE);
    });
  });
});
