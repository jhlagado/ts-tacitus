import { createVM } from '../../core/vm';
import type { ActiveDefinition } from '../../lang/state';
import { define, hideDictionaryHead } from '../../core/dictionary';
import { Tagged, Tag } from '../../core';
import { encodeX1516 } from '../../core/code-ref';

describe('compiler-hooks (Isolated)', () => {
  it('invokes the end definition handler', () => {
    // Disable caching for this test to avoid isolation issues
    const vm = createVM();
    define(vm, 'test', Tagged(encodeX1516(0), Tag.CODE, 0));
    hideDictionaryHead(vm);

    // Create a mock definition so endDefinition doesn't throw "Unexpected semicolon"
    const mockDefinition: ActiveDefinition = {
      branchPos: 0,
      checkpoint: vm.gp, // Dictionary mark (heap position)
      entryCell: vm.head,
    };
    vm.currentDefinition = mockDefinition;

    const { invokeEndDefinitionHandler } = require('../../lang/compiler-hooks');
    // Should not throw when currentDefinition is set with a valid definition
    expect(() => invokeEndDefinitionHandler(vm)).not.toThrow();
  });

  it('throws when no handler is registered', () => {
    // Disable caching for this test to avoid isolation issues
    const vm = createVM(false);
    const { invokeEndDefinitionHandler } = require('../../lang/compiler-hooks');
    expect(() => invokeEndDefinitionHandler(vm)).toThrow('End-definition handler not installed');
  });
});
