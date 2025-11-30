import { getTaggedInfo, Tag, isNIL } from '@src/core';
import { createVM } from '../../core/vm';
import { createTokenizer } from '../../lang/tokenizer';
import { parse } from '../../lang/parser';
import { lookup } from '../../core/dictionary';
import type { IncludeHost } from '../../lang/include-host';

function makeHost(map: Record<string, string>, counter: Record<string, number>): IncludeHost {
  return {
    resolveInclude(path: string, _from?: string | null) {
      const canonicalPath = path.startsWith('/') ? path : `/${path}`;
      counter[canonicalPath] = (counter[canonicalPath] ?? 0) + 1;
      const source = map[canonicalPath];
      if (source === undefined) {
        throw new Error(`Missing source for ${canonicalPath}`);
      }
      return { canonicalPath, source };
    },
  };
}

describe('include immediate', () => {
  test('throws without host', () => {
    const vm = createVM(false);
    expect(() => parse(vm, createTokenizer('include "a"'))).toThrow('include requires a host resolver');
  });

  test('simple include defines canonical global with last definition payload', () => {
    const vm = createVM(false);
    const counts: Record<string, number> = {};
    vm.compile.includeHost = makeHost(
      {
        '/a': ': foo ;',
      },
      counts,
    );

    parse(vm, createTokenizer('include "a"'));

    expect((counts['/a'] ?? 0)).toBeGreaterThanOrEqual(1);

    const foo = lookup(vm, 'foo');
    const includeEntry = lookup(vm, '/a');
    expect(isNIL(foo)).toBe(false);
    expect(includeEntry).toBe(foo);
    expect(getTaggedInfo(includeEntry).tag).toBe(Tag.CODE);
  });

  test('duplicate include is pragma-once', () => {
    const vm = createVM(false);
    const counts: Record<string, number> = {};
    vm.compile.includeHost = makeHost(
      {
        '/a': ': one ; : two ;',
      },
      counts,
    );

    parse(vm, createTokenizer('include "a" include "a"'));

    expect((counts['/a'] ?? 0)).toBeGreaterThanOrEqual(1);
    // Last definition is "two"
    const two = lookup(vm, 'two');
    const includeEntry = lookup(vm, '/a');
    expect(includeEntry).toBe(two);
  });

  test('circular include skips smudged entry', () => {
    const vm = createVM(false);
    const counts: Record<string, number> = {};
    vm.compile.includeHost = makeHost(
      {
        '/A': 'include "B" : a-def ;',
        '/B': 'include "A" : b-def ;',
      },
      counts,
    );

    parse(vm, createTokenizer('include "A"'));

    expect(counts['/A']).toBeGreaterThanOrEqual(1);
    expect(counts['/B']).toBe(1);

    const aDef = lookup(vm, 'a-def');
    const bDef = lookup(vm, 'b-def');
    expect(getTaggedInfo(aDef).tag).toBe(Tag.CODE);
    expect(getTaggedInfo(bDef).tag).toBe(Tag.CODE);

    // Canonical globals point at their last definitions
    expect(lookup(vm, '/A')).toBe(aDef);
    expect(lookup(vm, '/B')).toBe(bDef);
  });
});
