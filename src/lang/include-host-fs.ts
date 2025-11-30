import * as fs from 'fs';
import * as path from 'path';
import type { IncludeHost, IncludeResolveResult } from './include-host';
import type { VM } from '../core/vm';

/**
 * Filesystem-backed include host.
 *
 * - Resolves relative targets against the including file (from) when present, otherwise against tacitHome.
 * - Normalizes to an absolute path, reads UTF-8 source.
 * - Canonical key is the path relative to tacitHome, prefixed with '/', with POSIX separators.
 *   If the file is outside tacitHome, the absolute path is used as the key.
 */
export function makeFsIncludeHost(tacitHome: string): IncludeHost {
  const home = path.resolve(tacitHome);
  return {
    resolveInclude(target: string, from?: string | null): IncludeResolveResult {
      const base = from ? path.dirname(from) : home;
      const absPath = path.resolve(base, target);
      const source = fs.readFileSync(absPath, 'utf8');
      let canonicalPath: string;
      if (absPath.startsWith(home)) {
        const rel = path.relative(home, absPath);
        canonicalPath = `/${rel.split(path.sep).join('/')}`;
      } else {
        canonicalPath = absPath;
      }
      return { canonicalPath, source };
    },
  };
}

/**
 * Attach a filesystem include host to a VM. Tacit home defaults to process cwd.
 */
export function attachFsIncludeHost(vm: VM, tacitHome?: string): void {
  const home = tacitHome ?? process.env['TACIT_HOME'] ?? process.cwd();
  vm.compile.includeHost = makeFsIncludeHost(home);
}
