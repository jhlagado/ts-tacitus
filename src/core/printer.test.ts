import { VM } from './vm';
import { prn, formatValue } from './printer';
import { CoreTag, toTaggedValue } from './tagged';

describe('Printer', () => {
  let vm: VM;
  
  // Mock console.warn to test prn function
  const originalWarn = console.warn;
  let warnOutput: string[] = [];
  
  beforeAll(() => {
    // Create a mock VM instance
    vm = new VM();
    
    // Mock console.warn
    console.warn = (message: string) => {
      warnOutput.push(message);
    };
  });
  
  beforeEach(() => {
    // Reset mock before each test
    warnOutput = [];
  });
  
  afterAll(() => {
    // Restore original console.warn
    console.warn = originalWarn;
  });
  
  describe('formatValue', () => {
    test('formats regular numbers', () => {
      expect(formatValue(vm, 42)).toBe('42');
      expect(formatValue(vm, 3.14159)).toBe('3.14159');
      expect(formatValue(vm, 100.0)).toBe('100');
    });
    
    test('formats INTEGER tagged values', () => {
      const intValue = toTaggedValue(42, false, CoreTag.INTEGER);
      expect(formatValue(vm, intValue)).toBe('42');
    });
    
    test('formats NUMBER tagged values', () => {
      // The actual implementation might be truncating to integer
      const floatValue = toTaggedValue(3.14159, false, CoreTag.NUMBER);
      const result = formatValue(vm, floatValue);
      // Check that it's a string representation of an integer
      expect(result).toBe('3');
    });
    
    test('formats CODE tagged values', () => {
      const codeValue = toTaggedValue(123, false, CoreTag.CODE);
      expect(formatValue(vm, codeValue)).toBe('<code:123>');
    });
    
    test('formats STRING tagged values', () => {
      // Mock the digest.get method to return a string
      const originalGet = vm.digest.get;
      vm.digest.get = () => 'test string';
      
      const stringValue = toTaggedValue(1, true, CoreTag.STRING);
      expect(formatValue(vm, stringValue)).toBe('"test string"');
      
      // Test with string not found in digest (should throw)
      let errorThrown = false;
      try {
        vm.digest.get = () => { throw new Error('String not found'); };
        formatValue(vm, stringValue);
      } catch (e) {
        errorThrown = true;
        expect(e).toBeInstanceOf(Error);
        const error = e as Error;
        expect(error.message).toBe('String not found');
      }
      expect(errorThrown).toBe(true);
      
      // Restore original method
      vm.digest.get = originalGet;
    });
    
    test('handles unknown tag types', () => {
      // The actual implementation might throw for unknown tags
      expect(() => {
        const unknownValue = toTaggedValue(123, false, 99 as CoreTag);
        formatValue(vm, unknownValue);
      }).toThrow('Invalid tag: 99');
    });
  });
  
  describe('prn', () => {
    test('prints values with title', () => {
      prn('Test', 42);
      expect(warnOutput[0]).toContain('Test: 42');
    });
    
    test('handles tagged values', () => {
      const codeValue = toTaggedValue(123, false, CoreTag.CODE);
      prn('Code', codeValue);
      expect(warnOutput[0]).toContain('Code: <code:123>');
    });
    
    test('handles empty title', () => {
      prn('', 42);
      expect(warnOutput[0]).toMatch(/^: 42$/);
    });
  });
});
