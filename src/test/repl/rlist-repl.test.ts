import { describe, it, expect } from '@jest/globals';
import { captureTacitOutput } from '../utils/test-utils';

describe('REPL RLIST display', () => {
  it('prints simple RLIST', () => {
    const out = captureTacitOutput('( 1 2 3 ) print');
    expect(out).toEqual(['( 1 2 3 )']);
  });

  it('prints nested RLIST', () => {
    const out = captureTacitOutput('( 1 ( 2 3 ) 4 ) print');
    expect(out).toEqual(['( 1 ( 2 3 ) 4 )']);
  });
});
