import { createInterface } from 'readline';
import { startREPL } from '../../lang/repl';
import { processFile } from '../../lang/file-processor';
import { parse } from '../../lang/parser';
import { execute } from '../../lang/interpreter';

jest.mock('readline');
jest.mock('../../lang/file-processor');
jest.mock('../../lang/parser');
jest.mock('../../lang/interpreter');
describe('REPL', () => {
  let mockCreateInterface: jest.Mock;
  let mockOn: jest.Mock;
  let mockPrompt: jest.Mock;
  let mockClose: jest.Mock;
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  beforeEach(() => {
    console.log = jest.fn();
    console.error = jest.fn();
    mockCreateInterface = createInterface as jest.Mock;
    mockOn = jest.fn();
    mockPrompt = jest.fn();
    mockClose = jest.fn();
    mockCreateInterface.mockReturnValue({
      on: mockOn,
      prompt: mockPrompt,
      close: mockClose,
    });

    jest.clearAllMocks();
  });
  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });
  test('should initialize the interpreter on startup', () => {
    startREPL();
  });
  test('should handle no files case', () => {
    startREPL();
    expect(processFile).not.toHaveBeenCalled();
    expect(mockCreateInterface).toHaveBeenCalled();
    expect(mockPrompt).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Interactive mode'));
  });
  test('should process files when provided', () => {
    (processFile as jest.Mock).mockReturnValue(true);
    startREPL(['file1.tacit', 'file2.tacit']);
    expect(processFile).toHaveBeenCalledTimes(2);
    expect(processFile).toHaveBeenNthCalledWith(1, expect.any(Object), 'file1.tacit');
    expect(processFile).toHaveBeenNthCalledWith(2, expect.any(Object), 'file2.tacit');
    expect(mockCreateInterface).toHaveBeenCalled();
    expect(mockPrompt).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith('Loading 2 file(s)...');
    expect(console.log).toHaveBeenCalledWith('All files loaded successfully.');
  });
  test('should handle file processing errors', () => {
    (processFile as jest.Mock).mockReturnValue(false);
    startREPL(['file1.tacit']);
    expect(processFile).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error processing file'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Some files had errors'));
  });
  test('should not enter interactive mode when interactiveAfterFiles is false', () => {
    (processFile as jest.Mock).mockReturnValue(true);
    startREPL(['file1.tacit'], false);
    expect(processFile).toHaveBeenCalledTimes(1);
    expect(mockCreateInterface).not.toHaveBeenCalled();
  });
  test('should handle the "exit" command', () => {
    mockOn.mockImplementation((event, callback) => {
      if (event === 'line') {
        callback('exit');
      }
    });

    startREPL();
    expect(console.log).toHaveBeenCalledWith('Goodbye!');
    expect(mockClose).toHaveBeenCalled();
  });
  test('should handle the "load" command', () => {
    (processFile as jest.Mock).mockReturnValue(true);
    mockOn.mockImplementation((event, callback) => {
      if (event === 'line') {
        callback('load test.tacit');
      }
    });

    startREPL();
    expect(processFile).toHaveBeenCalledWith(expect.any(Object), 'test.tacit');
    expect(mockPrompt).toHaveBeenCalledTimes(2);
  });
  test('should handle errors during "load" command', () => {
    (processFile as jest.Mock).mockReturnValue(false);
    mockOn.mockImplementation((event, callback) => {
      if (event === 'line') {
        callback('load test.tacit');
      }
    });

    startREPL();
    expect(processFile).toHaveBeenCalledWith(expect.any(Object), 'test.tacit');
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('errors but REPL will continue'),
    );
    expect(mockPrompt).toHaveBeenCalledTimes(2);
  });
  test('should handle exceptions during "load" command', () => {
    const testError = new Error('Test error');
    (processFile as jest.Mock).mockImplementation(() => {
      throw testError;
    });
    mockOn.mockImplementation((event, callback) => {
      if (event === 'line') {
        callback('load test.tacit');
      }
    });

    startREPL();
    expect(processFile).toHaveBeenCalledWith(expect.any(Object), 'test.tacit');
    expect(console.error).toHaveBeenCalledWith('Error loading file:');
    expect(console.error).toHaveBeenCalledWith('  Test error');
    expect(mockPrompt).toHaveBeenCalledTimes(2);
  });
  test('should execute standard commands', () => {
    (parse as jest.Mock).mockImplementation(() => {});
    (execute as jest.Mock).mockImplementation(() => {});
    mockOn.mockImplementation((event, callback) => {
      if (event === 'line') {
        callback('2 3 +');
      }
    });

    startREPL();
    expect(parse).toHaveBeenCalled();
    expect(execute).toHaveBeenCalled();
    expect(mockPrompt).toHaveBeenCalledTimes(2);
  });
  test('should handle execution errors', () => {
    const testError = new Error('Execution error');
    (parse as jest.Mock).mockImplementation(() => {});
    (execute as jest.Mock).mockImplementation(() => {
      throw testError;
    });
    mockOn.mockImplementation((event, callback) => {
      if (event === 'line') {
        callback('invalid');
      }
    });

    startREPL();
    expect(console.error).toHaveBeenCalledWith('Error: Execution error');
    expect(mockPrompt).toHaveBeenCalledTimes(2);
  });
  test('should handle non-Error execution errors', () => {
    (parse as jest.Mock).mockImplementation(() => {});
    (execute as jest.Mock).mockImplementation(() => {
      throw 'String error';
    });
    mockOn.mockImplementation((event, callback) => {
      if (event === 'line') {
        callback('invalid');
      }
    });

    startREPL();
    expect(console.error).toHaveBeenCalledWith('Unknown error occurred');
    expect(mockPrompt).toHaveBeenCalledTimes(2);
  });
  test('should handle the "close" event', () => {
    mockOn.mockImplementation((event, callback) => {
      if (event === 'close') {
        callback();
      }
    });

    startREPL();
    expect(console.log).toHaveBeenCalledWith('REPL exited.');
  });
  test('should handle invalid commands in REPL', () => {
    mockOn.mockImplementation((event, callback) => {
      if (event === 'line') {
        callback('invalidCommand');
      }
    });
    startREPL();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Unknown error occurred'));
  });
  test('should handle empty input in REPL', () => {
    mockOn.mockImplementation((event, callback) => {
      if (event === 'line') {
        callback('');
      }
    });
    startREPL();
    expect(mockPrompt).toHaveBeenCalledTimes(2);
  });
});
