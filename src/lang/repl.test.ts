import { createInterface } from 'readline';
import { startREPL } from './repl';
import { executeLine, setupInterpreter } from './executor';
import { processFile } from './fileProcessor';

// Mock dependencies
jest.mock('readline');
jest.mock('./executor');
jest.mock('./fileProcessor');

describe('REPL', () => {
  let mockCreateInterface: jest.Mock;
  let mockOn: jest.Mock;
  let mockPrompt: jest.Mock;
  let mockClose: jest.Mock;

  // Save original console methods
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;

  beforeEach(() => {
    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();

    // Setup readline mock
    mockCreateInterface = createInterface as jest.Mock;
    mockOn = jest.fn();
    mockPrompt = jest.fn();
    mockClose = jest.fn();

    mockCreateInterface.mockReturnValue({
      on: mockOn,
      prompt: mockPrompt,
      close: mockClose,
    });

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  it('should initialize the interpreter on startup', () => {
    // Act
    startREPL();

    // Assert
    expect(setupInterpreter).toHaveBeenCalledTimes(1);
  });

  it('should handle no files case', () => {
    // Act
    startREPL();

    // Assert
    expect(processFile).not.toHaveBeenCalled();
    expect(mockCreateInterface).toHaveBeenCalled();
    expect(mockPrompt).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Interactive mode'));
  });

  it('should process files when provided', () => {
    // Arrange
    (processFile as jest.Mock).mockReturnValue(true);

    // Act
    startREPL(['file1.tacit', 'file2.tacit']);

    // Assert
    expect(processFile).toHaveBeenCalledTimes(2);
    expect(mockCreateInterface).toHaveBeenCalled();
    expect(mockPrompt).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith('Loading 2 file(s)...');
    expect(console.log).toHaveBeenCalledWith('All files loaded successfully.');
  });

  it('should handle file processing errors', () => {
    // Arrange
    (processFile as jest.Mock).mockReturnValue(false);

    // Act
    startREPL(['file1.tacit']);

    // Assert
    expect(processFile).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error processing file'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Some files had errors'));
  });

  it('should not enter interactive mode when interactiveAfterFiles is false', () => {
    // Arrange
    (processFile as jest.Mock).mockReturnValue(true);

    // Act
    startREPL(['file1.tacit'], false);

    // Assert
    expect(processFile).toHaveBeenCalledTimes(1);
    expect(mockCreateInterface).not.toHaveBeenCalled();
  });

  it('should handle the "exit" command', () => {
    // Arrange
    mockOn.mockImplementation((event, callback) => {
      if (event === 'line') {
        callback('exit');
      }
    });

    // Act
    startREPL();

    // Assert
    expect(console.log).toHaveBeenCalledWith('Goodbye!');
    expect(mockClose).toHaveBeenCalled();
  });

  it('should handle the "load" command', () => {
    // Arrange
    (processFile as jest.Mock).mockReturnValue(true);

    mockOn.mockImplementation((event, callback) => {
      if (event === 'line') {
        callback('load test.tacit');
      }
    });

    // Act
    startREPL();

    // Assert
    expect(processFile).toHaveBeenCalledWith('test.tacit');
    expect(mockPrompt).toHaveBeenCalledTimes(2); // Initial + after load
  });

  it('should handle errors during "load" command', () => {
    // Arrange
    (processFile as jest.Mock).mockReturnValue(false);

    mockOn.mockImplementation((event, callback) => {
      if (event === 'line') {
        callback('load test.tacit');
      }
    });

    // Act
    startREPL();

    // Assert
    expect(processFile).toHaveBeenCalledWith('test.tacit');
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('errors but REPL will continue')
    );
    expect(mockPrompt).toHaveBeenCalledTimes(2); // Initial + after error
  });

  it('should handle exceptions during "load" command', () => {
    // Arrange
    const testError = new Error('Test error');
    (processFile as jest.Mock).mockImplementation(() => {
      throw testError;
    });

    mockOn.mockImplementation((event, callback) => {
      if (event === 'line') {
        callback('load test.tacit');
      }
    });

    // Act
    startREPL();

    // Assert
    expect(processFile).toHaveBeenCalledWith('test.tacit');
    expect(console.error).toHaveBeenCalledWith('Error loading file:');
    expect(console.error).toHaveBeenCalledWith('  Test error');
    expect(mockPrompt).toHaveBeenCalledTimes(2); // Initial + after error
  });

  it('should execute standard commands', () => {
    // Arrange
    mockOn.mockImplementation((event, callback) => {
      if (event === 'line') {
        callback('2 3 +');
      }
    });

    // Act
    startREPL();

    // Assert
    expect(executeLine).toHaveBeenCalledWith('2 3 +');
    expect(mockPrompt).toHaveBeenCalledTimes(2); // Initial + after execution
  });

  it('should handle execution errors', () => {
    // Arrange
    const testError = new Error('Execution error');
    (executeLine as jest.Mock).mockImplementation(() => {
      throw testError;
    });

    mockOn.mockImplementation((event, callback) => {
      if (event === 'line') {
        callback('invalid');
      }
    });

    // Act
    startREPL();

    // Assert
    expect(executeLine).toHaveBeenCalledWith('invalid');
    expect(console.error).toHaveBeenCalledWith('Error: Execution error');
    expect(mockPrompt).toHaveBeenCalledTimes(2); // Initial + after error
  });

  it('should handle non-Error execution errors', () => {
    // Arrange
    (executeLine as jest.Mock).mockImplementation(() => {
      throw 'String error';
    });

    mockOn.mockImplementation((event, callback) => {
      if (event === 'line') {
        callback('invalid');
      }
    });

    // Act
    startREPL();

    // Assert
    expect(executeLine).toHaveBeenCalledWith('invalid');
    expect(console.error).toHaveBeenCalledWith('Unknown error occurred');
    expect(mockPrompt).toHaveBeenCalledTimes(2); // Initial + after error
  });

  it('should handle the "close" event', () => {
    // Arrange
    mockOn.mockImplementation((event, callback) => {
      if (event === 'close') {
        callback();
      }
    });

    // Act
    startREPL();

    // Assert
    expect(console.log).toHaveBeenCalledWith('REPL exited.');
  });

  it('should handle invalid commands in REPL', () => {
    mockOn.mockImplementation((event, callback) => {
      if (event === 'line') {
        callback('invalidCommand');
      }
    });

    startREPL();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Unknown error occurred'));
  });

  it('should handle empty input in REPL', () => {
    mockOn.mockImplementation((event, callback) => {
      if (event === 'line') {
        callback('');
      }
    });

    startREPL();
    expect(mockPrompt).toHaveBeenCalledTimes(2); // Initial + after empty input
  });
});
