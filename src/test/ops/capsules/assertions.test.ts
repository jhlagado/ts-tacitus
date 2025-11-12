import { Tag, toTaggedValue } from '../../../core';
import { createVM, type VM } from '../../../core/vm';
import { assertCapsuleShape } from '../../../ops/capsules/assertions';
import { pushTestList } from '../../utils/vm-test-utils';
import { push, peek } from '../../../core/vm';
import { encodeX1516 } from '../../../core/code-ref';

describe('capsule assertions', () => {
  let vm: VM;

  beforeEach(() => {
    vm = createVM();
  });

  test('accepts well-formed capsule', () => {
    const codeRef = toTaggedValue(encodeX1516(42), Tag.CODE);
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
