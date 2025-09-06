import { describe, it, expect } from '@jest/globals';
import { captureTacitOutput } from '../utils/vm-test-utils';

describe('REPL LIST display', () => {
  it('prints simple LIST', () => {
    const out = captureTacitOutput('( 1 2 3 ) .');
    expect(out).toEqual(['( 1 2 3 )']);
  });

  it('prints nested LIST', () => {
    const out = captureTacitOutput('( 1 ( 2 3 ) 4 ) .');
    expect(out).toEqual(['( 1 ( 2 3 ) 4 )']);
  });
});
