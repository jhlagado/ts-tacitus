import { describe, expect, test, beforeAll, afterAll } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { makeFsIncludeHost } from '../../lang/include-host-fs';

describe('makeFsIncludeHost', () => {
  let home: string;
  let outside: string;

  beforeAll(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'tacit-home-'));
    outside = fs.mkdtempSync(path.join(os.tmpdir(), 'tacit-outside-'));
  });

  afterAll(() => {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  });

  test('resolves relative include against home when no source provided', () => {
    const target = path.join(home, 'mod.tacit');
    fs.writeFileSync(target, 'home-file');
    const host = makeFsIncludeHost(home);

    const result = host.resolveInclude('mod.tacit', null);

    expect(result.canonicalPath).toBe('/mod.tacit');
    expect(result.source).toBe('home-file');
  });

  test('resolves relative include against including file location', () => {
    const subdir = path.join(home, 'sub');
    fs.mkdirSync(subdir);
    const target = path.join(subdir, 'inner.tacit');
    fs.writeFileSync(target, 'inner-file');
    const host = makeFsIncludeHost(home);
    const from = path.join(subdir, 'caller.tacit');

    const result = host.resolveInclude('./inner.tacit', from);

    expect(result.canonicalPath).toBe('/sub/inner.tacit');
    expect(result.source).toBe('inner-file');
  });

  test('uses absolute path as canonical when outside tacit home', () => {
    const target = path.join(outside, 'ext.tacit');
    fs.writeFileSync(target, 'outside-file');
    const host = makeFsIncludeHost(home);

    const result = host.resolveInclude(target, null);

    expect(result.canonicalPath).toBe(target);
    expect(result.source).toBe('outside-file');
  });
});
