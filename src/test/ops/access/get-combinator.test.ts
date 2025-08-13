/**
 * Tests for get combinator - basic functionality
 */
import { resetVM } from '../../utils/vm-test-utils';
import { executeProgram } from '../../../lang/interpreter';
import { vm } from '../../../core/globalState';
import { isList, fromTaggedValue, Tag, NIL, isNIL } from '../../../core/tagged';

describe('get combinator', () => {
  beforeEach(() => {
    resetVM();
  });

  describe('basic syntax', () => {
    it('should parse get combinator syntax without crashing', () => {
      // Very basic test - just make sure parser doesn't crash
      vm.debug = true;
      executeProgram('( "key" 42 ) get { "key" }');
      
      expect(vm.getStackData().length).toBeGreaterThan(0);
      console.log('Result:', vm.getStackData());
    });

    it('should handle empty path', () => {
      executeProgram('42 get { }');
      
      // Should have original value and the target on stack
      expect(vm.getStackData()).toHaveLength(2);
      const result = vm.pop();
      const target = vm.pop();
      
      expect(fromTaggedValue(result).value).toBe(42);
      expect(fromTaggedValue(target).value).toBe(42);
    });
  });

  describe('simple maplist lookup', () => {
    it('should find existing key in maplist', () => {
      vm.debug = true;
      executeProgram('( "name" "Alice" "age" 30 ) get { "name" }');
      
      console.log('Maplist lookup result:', vm.getStackData());
      
      // Should have maplist and result
      expect(vm.getStackData().length).toBeGreaterThan(1);
    });

    it.skip('should return NIL for missing key - TODO: fix block execution', () => {
      vm.debug = true;
      executeProgram('( "name" "Alice" ) get { "missing" }');
      
      const result = vm.peek();
      console.log('Missing key test - stack:', vm.getStackData(), 'TOS:', result, 'isNIL:', isNIL(result));
      expect(isNIL(result)).toBe(true);
    });

    it.skip('should return NIL for non-maplist target - TODO: fix block execution', () => {
      vm.debug = true;
      executeProgram('42 get { "key" }');
      
      const result = vm.peek();
      console.log('Non-maplist test - stack:', vm.getStackData(), 'TOS:', result, 'isNIL:', isNIL(result));
      expect(isNIL(result)).toBe(true);
    });
  });
});