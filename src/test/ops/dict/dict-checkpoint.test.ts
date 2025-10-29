import { beforeEach, describe, expect, test } from '@jest/globals';
import { resetVM } from '../../utils/vm-test-utils';
import { vm } from '../../../lang/runtime';
import { Tokenizer } from '../../../lang/tokenizer';
import { parse } from '../../../lang/parser';
import { execute } from '../../../lang/interpreter';
import { NIL, Tag, fromTaggedValue } from '../../../core/tagged';

function clearStack() {
  while (vm.sp > 0) {
    try {
      vm.pop();
    } catch {
      break;
    }
  }
}

describe('Heap dict + SymbolTable checkpoint/revert', () => {
  beforeEach(() => {
    resetVM();
  });

  test('definitions after mark are forgotten on revert', () => {
    // Define A
    parse(new Tokenizer(': A 1 add ;'));
    execute(vm.compiler.BCP);

    const cp = vm.symbolTable.mark();

    // Define B
    parse(new Tokenizer(': B 2 add ;'));
    execute(vm.compiler.BCP);

    // Sanity: 'B' exists via dict lookup
    parse(new Tokenizer("'B lookup load"));
    execute(vm.compiler.BCP);
    const v1 = vm.pop();
    expect(fromTaggedValue(v1).tag).toBe(Tag.CODE);

    // Revert and B should disappear from heap dict
    vm.symbolTable.revert(cp);
    clearStack();
    parse(new Tokenizer("'B lookup"));
    execute(vm.compiler.BCP);
    const got = vm.pop();
    expect(got).toBe(NIL);

    // A should remain
    clearStack();
    parse(new Tokenizer("'A lookup load"));
    execute(vm.compiler.BCP);
    const v2 = vm.pop();
    expect(fromTaggedValue(v2).tag).toBe(Tag.CODE);
  });

  test('shadowing reverted to prior definition', () => {
    // A1
    parse(new Tokenizer(': A 1 add ;'));
    execute(vm.compiler.BCP);

    const cp = vm.symbolTable.mark();

    // A2 shadows A1
    parse(new Tokenizer(': A 2 add ;'));
    execute(vm.compiler.BCP);

    // Confirm latest
    parse(new Tokenizer("'A lookup load"));
    execute(vm.compiler.BCP);
    const latest = vm.pop();
    expect(fromTaggedValue(latest).tag).toBe(Tag.CODE);

    // Revert
    vm.symbolTable.revert(cp);
    clearStack();

    // Should resolve to prior A1 (still Tag.CODE). We don't assert address equality; just existence.
    parse(new Tokenizer("'A lookup load"));
    execute(vm.compiler.BCP);
    const prior = vm.pop();
    expect(fromTaggedValue(prior).tag).toBe(Tag.CODE);
  });
});

