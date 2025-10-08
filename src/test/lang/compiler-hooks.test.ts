import { jest } from '@jest/globals';

describe('compiler-hooks', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  const loadHooks = () => import('@src/lang/compiler-hooks');

  it('invokes the registered handler', async () => {
    const hooks = await loadHooks();
    const handler = jest.fn();
    hooks.setEndDefinitionHandler(handler);
    hooks.invokeEndDefinitionHandler();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('throws when no handler is registered', async () => {
    const { invokeEndDefinitionHandler } = await loadHooks();
    expect(() => invokeEndDefinitionHandler()).toThrow('End-definition handler not installed');
  });
});
