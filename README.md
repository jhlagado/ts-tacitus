# Forth-Style Interpreter in TypeScript

A simple Forth-style interpreter implemented in TypeScript. This project provides a basic REPL (Read-Eval-Print Loop) for executing Forth-like commands, including arithmetic operations, stack manipulation, and custom word definitions.

## Features

- **Stack-Based Operations**: Supports basic stack operations like `push`, `pop`, and `peek`.
- **Core Words**: Includes core words for arithmetic (`+`, `-`, `*`, `/`) and stack manipulation (`dup`, `drop`, `swap`).
- **Custom Words**: Allows defining new words (functions) in the dictionary.
- **Error Handling**: Provides detailed error messages for stack underflow, unknown words, and division by zero.
- **REPL**: Interactive Read-Eval-Print Loop for executing commands.

## Installation

1. Clone the repository:
   \`\`\`bash
   git clone https://github.com/your-username/forth-interpreter-ts.git
   cd forth-interpreter-ts
   \`\`\`

2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

3. Build the project:
   \`\`\`bash
   npm run build
   \`\`\`

## Usage

### Starting the REPL

To start the interactive REPL, run:
\`\`\`bash
npm start
\`\`\`

Example usage in the REPL:
\`\`\`
> 5 3 +
[8]
> 10 2 /
[5]
> dup
[5, 5]
> exit
Goodbye!
\`\`\`

### Running Tests

To run the test suite, use:
\`\`\`bash
npm test
\`\`\`

### Example Commands

- **Arithmetic**:
  \`\`\`
  > 5 3 +
  [8]
  > 10 2 /
  [5]
  \`\`\`

- **Stack Manipulation**:
  \`\`\`
  > 5 3
  [5, 3]
  > dup
  [5, 3, 3]
  > drop
  [5, 3]
  > swap
  [3, 5]
  \`\`\`

- **Error Handling**:
  \`\`\`
  > 5 0 /
  Error: Error executing word '/' (stack: [5,0]): Division by zero
  > unknown
  Error: Unknown word: unknown
  \`\`\`

## Implementation Details

### Core Components

1. **Stack**:
   - A simple stack implementation with operations like `push`, `pop`, `peek`, and `clear`.
   - Defined in `src/stack.ts`.

2. **Dictionary**:
   - Manages a dictionary of words (functions) that can be executed by the interpreter.
   - Supports defining new words and looking up existing ones.
   - Defined in `src/dictionary.ts`.

3. **Interpreter**:
   - Executes Forth-like commands by interacting with the stack and dictionary.
   - Handles arithmetic operations, stack manipulation, and custom words.
   - Defined in `src/interpreter.ts`.

4. **REPL**:
   - Provides an interactive Read-Eval-Print Loop for executing commands.
   - Handles user input, executes commands, and displays results or errors.
   - Defined in `src/repl.ts`.

### Error Handling

The interpreter provides detailed error messages for:
- **Stack Underflow**: When there are not enough items on the stack for an operation.
- **Unknown Words**: When a word is not found in the dictionary.
- **Division by Zero**: When attempting to divide by zero.

Example error messages:
\`\`\`
Error executing word '+' (stack: []): Stack underflow
Error executing word '/' (stack: [5,0]): Division by zero
Unknown word: unknown
\`\`\`

### Extending the Interpreter

You can extend the interpreter by adding new words to the dictionary. For example, to add a word for squaring a number:

\`\`\`typescript
define(dictionary, "square", () => {
  const a = pop(stack);
  if (a !== undefined) {
    push(stack, a * a);
  }
});
\`\`\`

Example usage:
\`\`\`
> 5 square
[25]
\`\`\`

## Contributing

Contributions are welcome! If you'd like to contribute, please follow these steps:

1. Fork the repository.
2. Create a new branch for your feature or bugfix.
3. Commit your changes and push to your branch.
4. Submit a pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.