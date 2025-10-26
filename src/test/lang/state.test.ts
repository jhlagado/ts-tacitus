import type { ParserState } from '../../lang/state';
import type { Tokenizer } from '../../lang/tokenizer';
import { jest } from '@jest/globals';

describe('parser state helpers', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.resetAllMocks();
  });

  const mockRuntime = (getStackData: jest.Mock) => ({
    vm: {
      getStackData,
    },
  });

  const loadStateModule = async (getStackData: jest.Mock) => {
    jest.doMock('../../lang/runtime', () => mockRuntime(getStackData));
    return import('../../lang/state');
  };

  const makeState = (): ParserState => {
    const tokenizer = {
      input: 'noop',
      position: 0,
      column: 0,
    } as unknown as Tokenizer;
    return {
      tokenizer,
      currentDefinition: null,
    };
  };

  it('setParserState controls getParserState', async () => {
    const getStackData = jest.fn(() => []);
    const { setParserState, getParserState } = await loadStateModule(getStackData);
    const state = makeState();
    setParserState(state);
    expect(getParserState()).toBe(state);
    setParserState(null);
    expect(getParserState()).toBeNull();
  });

  it('requireParserState returns active state', async () => {
    const getStackData = jest.fn(() => []);
    const { setParserState, requireParserState } = await loadStateModule(getStackData);
    const state = makeState();
    setParserState(state);
    expect(requireParserState()).toBe(state);
  });

  it('requireParserState throws when state missing', async () => {
    const getStackData = jest.fn(() => ['stack-snapshot']);
    const { requireParserState } = await loadStateModule(getStackData);
    expect(() => requireParserState()).toThrow(
      'Definition opener/closer used outside of parser context',
    );
    expect(getStackData).toHaveBeenCalledTimes(1);
  });
});
