import { main } from './cli';
import { startREPL } from './lang/repl';

import { processFiles } from './lang/fileProcessor';

jest.mock('./lang/repl');
jest.mock('./lang/fileProcessor');
describe('CLI', () => {
  let originalArgv: string[];
  beforeEach(() => {
    originalArgv = process.argv;
    jest.clearAllMocks();
  });
  afterEach(() => {
    process.argv = originalArgv;
  });
  test('should start REPL with no files when none are provided', () => {
    process.argv = ['node', 'cli.js'];
    main();
    expect(startREPL).toHaveBeenCalledWith();
    expect(processFiles).not.toHaveBeenCalled();
  });
  test('should start REPL with files in interactive mode by default', () => {
    process.argv = ['node', 'cli.js', 'file1.tacit', 'file2.tacit'];
    main();
    expect(startREPL).toHaveBeenCalledWith(['file1.tacit', 'file2.tacit'], true);
    expect(processFiles).not.toHaveBeenCalled();
  });
  test('should process files without REPL when --no-interactive flag is used', () => {
    process.argv = ['node', 'cli.js', 'file1.tacit', '--no-interactive', 'file2.tacit'];
    main();
    expect(startREPL).not.toHaveBeenCalled();
    expect(processFiles).toHaveBeenCalledWith(['file1.tacit', 'file2.tacit']);
  });
});
