import { Tag, toTaggedValue } from '../../../core';
import { vm } from '../../utils/vm-test-utils';
import { assertCapsuleShape } from '../../../ops/capsules/assertions';
import { resetVM, pushTestList } from '../../utils/vm-test-utils';
import { push, peek } from '../../../core/vm';

describe('capsule assertions', () => {
  beforeEach(() => {
    resetVM();
  });

  test('accepts well-formed capsule', () => {
    const codeRef = toTaggedValue(42, Tag.CODE);
    pushTestList(vm, [1, 2, codeRef]);
    const header = peek(vm);
    expect(() => assertCapsuleShape(vm, header)).not.toThrow();
  });

  test('rejects non-list values', () => {
    push(vm, 123);
    expect(() => assertCapsuleShape(vm, peek(vm))).toThrow('LIST');
  });

  test('rejects capsule without code reference', () => {
    pushTestList(vm, [1, 2, 3]);
    const header = peek(vm);
    expect(() => assertCapsuleShape(vm, header)).toThrow('CODE_REF');
  });
});
