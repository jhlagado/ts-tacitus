import { describe, test, expect, beforeEach } from '@jest/globals';
import { createVM, VM } from '../../../../core';
import { executeTacitCode } from '../../../utils/vm-test-utils';

describe('Concat operation scenarios', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('simple + simple -> ( 1 2 )', () => {
    const result = executeTacitCode(vm, '1 2 concat');
    const expected = executeTacitCode(vm, '( 1 2 )');
    expect(result).toEqual(expected);
  });

  test('simple + list (prepend) -> ( 1 2 3 )', () => {
    const result = executeTacitCode(vm, '1 ( 2 3 ) concat');
    const expected = executeTacitCode(vm, '( 1 2 3 )');
    expect(result).toEqual(expected);
  });

  test('list + simple (append) -> ( 1 2 3 )', () => {
    const result = executeTacitCode(vm, '( 1 2 ) 3 concat');
    const expected = executeTacitCode(vm, '( 1 2 3 )');
    expect(result).toEqual(expected);
  });

  test('list + list (flat) -> ( 1 2 3 4 )', () => {
    const result = executeTacitCode(vm, '( 1 2 ) ( 3 4 ) concat');
    const expected = executeTacitCode(vm, '( 1 2 3 4 )');
    expect(result).toEqual(expected);
  });

  test('empty + list -> list', () => {
    const result = executeTacitCode(vm, '( ) ( 7 8 ) concat');
    const expected = executeTacitCode(vm, '( 7 8 )');
    expect(result).toEqual(expected);
  });

  test('list + empty -> list', () => {
    const result = executeTacitCode(vm, '( 7 8 ) ( ) concat');
    const expected = executeTacitCode(vm, '( 7 8 )');
    expect(result).toEqual(expected);
  });

  test('empty + empty -> empty', () => {
    const result = executeTacitCode(vm, '( ) ( ) concat');
    const expected = executeTacitCode(vm, '( )');
    expect(result).toEqual(expected);
  });

  test('nested elements preserved as units', () => {
    const result = executeTacitCode(vm, '( ( 1 2 ) 3 ) ( 4 ( 5 ) ) concat');
    const expected = executeTacitCode(vm, '( ( 1 2 ) 3 4 ( 5 ) )');
    expect(result).toEqual(expected);
  });
});
