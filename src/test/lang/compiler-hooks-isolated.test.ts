import { jest } from '@jest/globals';
import { createVM } from '../../core/vm';
import type { ActiveDefinition } from '../../lang/state';

describe('compiler-hooks (Isolated)', () => {
  it('invokes the end definition handler', () => {
    // Disable caching for this test to avoid isolation issues
    const vm = createVM();
    // Create a mock definition so endDefinition doesn't throw "Unexpected semicolon"
    const mockDefinition: ActiveDefinition = {
      name: 'test',
      branchPos: 0,
      checkpoint: 0, // Dictionary mark (heap position)
    };
    const currentDefinition: { current: ActiveDefinition | null } = { current: mockDefinition };
    (vm as typeof vm & { _currentDefinition: { current: ActiveDefinition | null } })._currentDefinition = currentDefinition;

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

