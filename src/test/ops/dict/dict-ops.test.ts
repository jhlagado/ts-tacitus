import { beforeEach, describe, expect, test } from '@jest/globals';
import { NIL, Tag, toTaggedValue } from '../../../core/tagged';
import { resetVM, executeTacitCode } from '../../utils/vm-test-utils';

describe('Heap-backed dictionary ops', () => {
  beforeEach(() => {
    resetVM();
  });

  test('define + lookup simple value', () => {
    const stack = executeTacitCode("42 'x define 'x lookup fetch");
    expect(stack).toEqual([42]);
  });

  test('define + lookup list value', () => {
    const stack = executeTacitCode("( 1 2 ) 'xs define 'xs lookup fetch length");
    expect(stack).toEqual([2]);
  });

  test('shadowing returns latest definition', () => {
    const stack = executeTacitCode("1 'a define 2 'a define 'a lookup fetch");
    expect(stack).toEqual([2]);
  });

  test('mark + forget removes entries after mark', () => {
    const stack = executeTacitCode("1 'a define mark 2 'b define forget 'b lookup 'a lookup fetch");
    expect(stack).toEqual([NIL, 1]);
  });

  test('define rejects non-string name', () => {
    expect(() => executeTacitCode('42 99 define')).toThrow(/STRING name/);
  });

  test('lookup rejects non-string name', () => {
    expect(() => executeTacitCode('99 lookup')).toThrow(/STRING name/);
  });
});

