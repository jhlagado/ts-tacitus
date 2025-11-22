import { describe, test, expect, beforeEach, jest } from '@jest/globals';

jest.mock('../../../lang/definition-system', () => ({
  beginDefinition: jest.fn(),
}));

jest.mock('../../../lang/helpers/tokenizer-utils', () => ({
  ensureTokenizer: jest.fn(),
}));

jest.mock('../../../core/dictionary', () => {
  const actual = jest.requireActual(
    '../../../core/dictionary',
  ) as typeof import('../../../core/dictionary');
  return {
    ...actual,
    getDictionaryEntryInfo: jest.fn(),
  };
});

jest.mock('../../../core/vm', () => {
  const actual = jest.requireActual('../../../core/vm') as typeof import('../../../core/vm');
  return {
    ...actual,
    emitUserWordCall: jest.fn(),
  };
});

import { beginDefinitionImmediateOp, recurseImmediateOp } from '../../../lang/meta/definition-ops';
import { createVM, emitUserWordCall, getStackData, type VM } from '../../../core/vm';
import { beginDefinition } from '../../../lang/definition-system';
import { ensureTokenizer } from '../../../lang/helpers/tokenizer-utils';
import { getDictionaryEntryInfo } from '../../../core/dictionary';
import { Tagged, Tag, getTaggedInfo } from '../../../core/tagged';
import { encodeX1516 } from '../../../core/code-ref';
import { Op } from '../../../ops/opcodes';
import type { Tokenizer } from '../../../lang/tokenizer';

const beginDefinitionMock = beginDefinition as jest.MockedFunction<typeof beginDefinition>;
const ensureTokenizerMock = ensureTokenizer as jest.MockedFunction<typeof ensureTokenizer>;
const getDictionaryEntryInfoMock = getDictionaryEntryInfo as jest.MockedFunction<
  typeof getDictionaryEntryInfo
>;
const emitUserWordCallMock = emitUserWordCall as jest.MockedFunction<typeof emitUserWordCall>;

describe('definition immediates', () => {
  let vm: VM;

  beforeEach(() => {
    jest.clearAllMocks();
    vm = createVM();
  });

  test('beginDefinitionImmediateOp pushes closer and begins definition', () => {
    const tokenizer = {} as Tokenizer;
    ensureTokenizerMock.mockReturnValue(tokenizer);

    beginDefinitionImmediateOp(vm);

    expect(beginDefinitionMock).toHaveBeenCalledWith(vm, tokenizer);

    const stack = getStackData(vm);
    expect(stack).toHaveLength(1);
    const { tag, value } = getTaggedInfo(stack[0]);
    expect(tag).toBe(Tag.CODE);
    expect(value).toBe(Op.EndDefinition);
  });

  test('recurseImmediateOp rejects calls outside active definition', () => {
    vm.compile.entryCell = -1;
    expect(() => recurseImmediateOp(vm)).toThrow('RECURSE outside definition');
  });

  test('recurseImmediateOp enforces hidden active definition', () => {
    vm.compile.entryCell = 42;
    getDictionaryEntryInfoMock.mockReturnValue({
      hidden: false,
      payload: Tagged(0, Tag.LIST),
    } as never);

    expect(() => recurseImmediateOp(vm)).toThrow('RECURSE requires active definition');
  });

  test('recurseImmediateOp requires CODE payload', () => {
    vm.compile.entryCell = 42;
    getDictionaryEntryInfoMock.mockReturnValue({
      hidden: true,
      payload: Tagged(0, Tag.NUMBER),
    } as never);

    expect(() => recurseImmediateOp(vm)).toThrow('Active definition payload invalid for RECURSE');
  });

  test('recurseImmediateOp emits user-word call with decoded address', () => {
    vm.compile.entryCell = 99;
    const encoded = encodeX1516(512);
    getDictionaryEntryInfoMock.mockReturnValue({
      hidden: true,
      payload: Tagged(encoded, Tag.CODE),
    } as never);

    recurseImmediateOp(vm);

    expect(emitUserWordCallMock).toHaveBeenCalledWith(vm, 512);
  });
});
