import { main } from './cli';
import { startREPL } from './lang/repl';
import { processFiles } from './lang/fileProcessor';

// Mock dependencies
jest.mock('./lang/repl');
jest.mock('./lang/fileProcessor');

describe('CLI', () => {
  let originalArgv: string[];

  beforeEach(() => {
    // Save original process.argv
    originalArgv = process.argv;

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore process.argv
    process.argv = originalArgv;
  });

  it('should start REPL with no files when none are provided', () => {
    // Setup
    process.argv = ['node', 'cli.js'];

    // Act
    main();

    // Assert
    expect(startREPL).toHaveBeenCalledWith();
    expect(processFiles).not.toHaveBeenCalled();
  });

  it('should start REPL with files in interactive mode by default', () => {
    // Setup
    process.argv = ['node', 'cli.js', 'file1.tacit', 'file2.tacit'];

    // Act
    main();

    // Assert
    expect(startREPL).toHaveBeenCalledWith(['file1.tacit', 'file2.tacit'], true);
    expect(processFiles).not.toHaveBeenCalled();
  });

  it('should process files without REPL when --no-interactive flag is used', () => {
    // Setup
    process.argv = ['node', 'cli.js', 'file1.tacit', '--no-interactive', 'file2.tacit'];

    // Act
    main();

    // Assert
    expect(startREPL).not.toHaveBeenCalled();
    expect(processFiles).toHaveBeenCalledWith(['file1.tacit', 'file2.tacit']);
  });
});
