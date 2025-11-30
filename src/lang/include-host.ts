export type IncludeResolveResult = {
  canonicalPath: string;
  source: string;
};

export interface IncludeHost {
  /**
   * Resolve a relative include target into a canonical path and the file contents.
   * `from` is the current source path (if any) and may be used for relative resolution.
   */
  resolveInclude(path: string, from?: string | null): IncludeResolveResult;
}
