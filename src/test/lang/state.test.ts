import type { ParserState } from '../../lang/state';
import type { Tokenizer } from '../../lang/tokenizer';
import type { VM } from '../../core/vm';
import { jest } from '@jest/globals';

describe('parser state helpers', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.resetAllMocks();
  });

  const loadStateModule = async () => {
    return import('../../lang/state');
  };

  const makeState = (vmInstance?: unknown): ParserState => {
    const tokenizer = {
      input: 'noop',
      position: 0,
      column: 0,
    } as unknown as Tokenizer;
    return {
      vm: (vmInstance || { sp: 0, memory: {} }) as VM,
      tokenizer,
      currentDefinition: null,
    };
  };

  it('setParserState controls getParserState', async () => {
    const { setParserState, getParserState } = await loadStateModule();
    const state = makeState();
    setParserState(state);
    expect(getParserState()).toBe(state);
    setParserState(null);
    expect(getParserState()).toBeNull();
  });

  it('requireParserState returns active state', async () => {
    const { setParserState, requireParserState } = await loadStateModule();
    const state = makeState();
    setParserState(state);
    expect(requireParserState()).toBe(state);
  });

  it('requireParserState throws when state missing', async () => {
    const { requireParserState } = await loadStateModule();
    expect(() => requireParserState()).toThrow(
      'Definition opener/closer used outside of parser context',
    );
  });
});
