import { describe, test, expect, jest } from '@jest/globals';

jest.mock('../../../lang/meta/definition-ops', () => ({
  beginDefinitionImmediateOp: jest.fn(),
  recurseImmediateOp: jest.fn(),
}));

import { createVM } from '../../../core/vm';
import { executeImmediateOpcode, isBuiltinImmediateOpcode } from '../../../lang/meta';
import { beginDefinitionImmediateOp } from '../../../lang/meta/definition-ops';
import { Op } from '../../../ops/opcodes';

const beginDefinitionImmediateOpMock = beginDefinitionImmediateOp as jest.MockedFunction<
  typeof beginDefinitionImmediateOp
>;

describe('meta immediate index', () => {
  test('isBuiltinImmediateOpcode matches handler table', () => {
    expect(isBuiltinImmediateOpcode(Op.BeginIfImmediate)).toBe(true);
    expect(isBuiltinImmediateOpcode(9999 as Op)).toBe(false);
  });

  test('executeImmediateOpcode dispatches to the correct handler', () => {
    const vm = createVM();

    executeImmediateOpcode(vm, Op.BeginDefinitionImmediate);

    expect(beginDefinitionImmediateOpMock).toHaveBeenCalledWith(vm);
  });

  test('executeImmediateOpcode throws on unknown opcodes', () => {
    const vm = createVM();
    expect(() => executeImmediateOpcode(vm, 9999 as Op)).toThrow('Unknown immediate opcode');
  });
});
