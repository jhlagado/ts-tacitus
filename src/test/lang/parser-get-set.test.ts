/**
 * Parser tests for get/set combinators - Step 1 implementation
 * 
 * Tests parser behavior only, no runtime execution.
 * Validates syntax requirements and compilation patterns.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { executeProgram } from '../../lang/interpreter';
import { initializeInterpreter } from '../../core/globalState';

describe('Get/Set Combinator Parser - Step 1', () => {
  beforeEach(() => {
    initializeInterpreter();
  });

  describe('Syntax Requirements', () => {
    test('get requires block syntax', () => {
      expect(() => executeProgram('1 get')).toThrow('Expected { after get combinator');
    });
    
    test('set requires block syntax', () => {
      expect(() => executeProgram('1 2 set')).toThrow('Expected { after set combinator');
    });
  });
});