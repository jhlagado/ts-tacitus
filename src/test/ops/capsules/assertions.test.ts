import { Tag, toTaggedValue } from '../../../core';
import { vm } from '../../../core/global-state';
import { assertCapsuleShape } from '../../../ops/capsules/assertions';
import { resetVM, pushTestList } from '../../utils/vm-test-utils';

describe('capsule assertions', () => {
  beforeEach(() => {
    resetVM();
  });

  test('accepts well-formed capsule', () => {
    const codeRef = toTaggedValue(42, Tag.CODE);
    pushTestList(vm, [1, 2, codeRef]);
    const header = vm.peek();
    expect(() => assertCapsuleShape(vm, header)).not.toThrow();
  });

  test('rejects non-list values', () => {
    vm.push(123);
    expect(() => assertCapsuleShape(vm, vm.peek())).toThrow('LIST');
  });

  test('rejects capsule without code reference', () => {
    pushTestList(vm, [1, 2, 3]);
    const header = vm.peek();
    expect(() => assertCapsuleShape(vm, header)).toThrow('CODE_REF');
  });
});
