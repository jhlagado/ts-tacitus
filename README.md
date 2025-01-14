# Tacit Interpreter

Tacit is a **RPN-based tacit array programming language** inspired by **APL** and implemented on a **Forth-style virtual machine**. This interpreter allows you to write concise, expressive, and powerful array-oriented programs using a stack-based approach.

---

## Features

- **RPN (Reverse Polish Notation)**: Operations are written in postfix notation, making the language stack-based and easy to parse.
- **Tacit Programming**: Functions are composed without explicitly referencing their arguments, enabling a concise and expressive style.
- **Array-Oriented**: Inspired by APL, Tacit is designed for manipulating arrays and matrices with ease.
- **Forth-Style VM**: The interpreter is built on a Forth-like virtual machine, providing a simple and efficient runtime environment.
- **Extensible**: New words (functions) can be defined and added to the dictionary, making the language highly customizable.

---

## Getting Started

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/your-username/tacit-interpreter.git
   cd tacit-interpreter
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Run the interpreter:
   ```bash
   npm start
   ```

### Usage

Start the REPL (Read-Eval-Print Loop) by running the interpreter. You can enter commands directly, and the interpreter will evaluate them.

#### Example Commands

1. **Arithmetic**:

   ```tacit
   5 3 + .  # Output: 8
   ```

2. **Stack Manipulation**:

   ```tacit
   5 dup * .  # Output: 25
   ```

3. **Array Operations**:

   ```tacit
   [1 2 3] [4 5 6] + .  # Output: [5 7 9]
   ```

4. **Defining New Words**:
   ```tacit
   : square dup * ;
   5 square .  # Output: 25
   ```

---

## Language Overview

### Stack-Based Operations

Tacit uses a stack to manage data and operations. For example:

- `5 3 +` pushes `5` and `3` onto the stack, then adds them, leaving `8` on the stack.
- `.` prints the top of the stack.

### Array Operations

Tacit supports array operations inspired by APL:

- `[1 2 3] [4 5 6] +` adds the arrays element-wise, resulting in `[5 7 9]`.
- `[1 2 3] 2 *` multiplies each element by `2`, resulting in `[2 4 6]`.

### Defining New Words

You can define new words (functions) using the `:` syntax:

```tacit
: cube dup dup * * ;
3 cube .  # Output: 27
```

---

## Roadmap

### Short-Term Goals

- **Improve Array Support**: Add more array operations (e.g., reshape, reduce, scan).
- **Error Handling**: Enhance error messages and debugging tools.
- **Standard Library**: Build a standard library of common functions (e.g., math, statistics).

### Medium-Term Goals

- **Performance Optimization**: Optimize the virtual machine for faster execution.
- **Interactive Development Environment**: Build a web-based IDE for Tacit.
- **Documentation**: Write comprehensive documentation and tutorials.

### Long-Term Goals

- **Concurrency**: Add support for parallel and concurrent execution.
- **Interoperability**: Enable integration with other languages (e.g., JavaScript, Python).
- **Community**: Build a community around Tacit and encourage contributions.

---

## Contributing

Contributions are welcome! If you'd like to contribute, please:

1. Fork the repository.
2. Create a new branch for your feature or bugfix.
3. Submit a pull request.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- Inspired by **APL** and **Forth**.
- Built with ❤️ and TypeScript.

---

Happy coding! 🚀
