# TACITUS VIRTUAL MACHINE: KNOWLEDGE TRANSFER DOCUMENT

## 1. ARCHITECTURE OVERVIEW

### 1.1 Core Design Philosophy
- Stack-based virtual machine implementing Tacit, a concatenative language
- Designed for constrained environments with 64KB total memory footprint
- Fundamental philosophical pillars:
  - Functional composition through RPN syntax and combinator programming
  - Immutability as first principle (all data structures are persistent)
  - Deterministic execution without GC pauses
  - Memory efficiency through structural sharing and copy-on-write
  - Minimal core with powerful composition operators
  - Human-readable yet machine-efficient design

### 1.2 Stack-Based Execution Model
- Classical stack machine using Reverse Polish Notation
- Data flows through stack, consumed and produced by operations
- Stack operations manipulate an implicit data stack
- Core operations: push, pop, peek, swap, dup, drop
- This enables a "pipeline" mental model where data flows through transformations

### 1.3 Return Stack
- Secondary stack for function call management
- Stores return addresses for function calls
- Enables nested function calls with predictable depth
- Exposed to language for advanced control flow patterns
- Provides reliable and deterministic call/return semantics

### 1.4 Type System
- All values represented through 32-bit NaN-boxing technique
- IEEE-754 float format repurposed to encode type information
- Type tags embedded within quiet NaN pattern
- Enables direct representation of small integers, references, symbols
- Type checking performed via bit pattern recognition
- Eliminates need for separate type metadata storage

### 1.5 Memory Management
- Heap divided into fixed-size blocks (64 bytes each)
- Reference counting for deterministic memory management
- No garbage collection, eliminating unpredictable pauses
- Block structure includes refCount and type information
- First-fit allocation for predictable performance

### 1.6 Immutability and Structural Sharing
- All data structures implement immutability semantics
- Copy-on-write behavior when modifying shared structures
- Implementation ensures single-owner fast-path for performance
- Creates trees of data with shared subtrees for memory efficiency
- Critical for reliable behavior in resource-constrained environments

### 1.7 Concatenative Programming Model
- Programs constructed through function composition
- Functions operate directly on stack state
- No named parameters or explicit returns
- Function signatures described by stack effects
- Combinators handle higher-order operations
- Natural left-to-right evaluation matches mental model

### 1.8 Execution Pipeline
- Source text → Tokens → Bytecode → VM Execution
- Each stage performs a single responsibility transformation
- Results in a simple, linear execution model
- Straightforward compilation without complex optimizations
- Enables predictable execution characteristics

## 2. MEMORY MODEL

### 2.1 Segmented Memory Architecture
- Total memory size: 64KB (65536 bytes)
- Four logical segments of 16KB (16384 bytes) each:
  - SEG_CODE (0): Executable bytecode storage
  - SEG_DATA (1): Global variables and stack space
  - SEG_HEAP (2): Dynamically allocated objects
  - SEG_STRING (3): String interning pool (Digest)
- Segment addressing uses 2-bit segment ID + 14-bit offset
- Enforces memory protection between segments

### 2.2 Memory Access Patterns
- Strict bounds checking on all memory operations
- Segment-specific protection policies:
  - SEG_CODE: Read-only after compilation
  - SEG_DATA: Read-write for stack operations
  - SEG_HEAP: Reference-counted access
  - SEG_STRING: Write-once for interned strings
- Prevent buffer overflows and memory corruption

### 2.3 Stack Organization
- Parameter stack and return stack in SEG_DATA
- Stack grows downward from high to low addresses
- Protection boundaries prevent stack overflow/underflow
- Stack frames not explicitly maintained
- Stack effect documentation replaces formal parameter lists

### 2.4 Heap Organization
- Fixed-size block allocation (64 bytes per block)
- Block header contains reference count and type
- First-fit allocation strategy
- Free list for recycling released blocks
- No block splitting or coalescing

### 2.5 String Interning
- All strings stored uniquely in SEG_STRING
- Hash-based lookup ensures string deduplication
- O(1) string equality through address comparison
- Strings never moved or collected once stored
- Critical for efficient symbol lookups

### 2.6 NaN-Boxing Implementation
- Uses IEEE-754 floating point NaN pattern
- Quiet NaN bit + 4-bit type tag + 18-bit payload
- Direct representation for integers up to 2^18
- Heap addresses, symbol IDs encoded in payload
- Fast type checking through bit masks
- Zero memory overhead for type information

### 2.7 Memory Safety
- Segmentation isolates memory regions
- Reference counting prevents use-after-free
- Copy-on-write maintains immutability guarantees
- Explicit bounds checking for all access
- No pointer arithmetic or direct memory manipulation
- Type checking enforced for all operations

## 3. CORE COMPONENTS

### 3.1 Virtual Machine
- Central state container for the entire runtime
- Manages memory, stacks, instruction pointer, and compilation
- Maintains global symbol table and string digest
- Provides execution context for interpreter
- Single-threaded, deterministic execution model
- Checkpoint/restore capabilities for transactions

### 3.2 Digest System
- String interning pool for deduplication
- Hash-based lookups for O(1) average performance
- Sequential storage with length-prefixed format
- Enables fast string equality through pointer comparison
- Critical for symbol resolution performance

### 3.3 Symbol Table
- Maps names to executable functions or addresses
- Implemented as singly-linked list for simplicity
- Newest definitions stored at head (shadowing semantics)
- No namespaces or lexical scoping - global symbol space
- Provides mark/restore for temporary definition contexts
- Built-in primitives registered at bootstrap

### 3.4 Compiler
- Generates bytecode from parsed tokens
- Tracks compilation pointer in SEG_CODE
- Manages branch resolution and forward references
- No complex optimizations - straightforward code generation
- Provides preservation hints for code blocks

### 3.5 Tokenizer
- Converts source text to token stream
- Recognizes numbers, words, strings, and special tokens
- Handles multi-character operators and grouping symbols
- Provides line/column tracking for error reporting
- Implements lookahead/backtracking for complex parsing

### 3.6 Parser
- Recursive descent parser implementation
- Directly emits bytecode (no intermediate AST)
- Enforces syntactic constraints and well-formedness
- Special handling for definition forms, blocks, and control flow
- Branch resolution for forward references

### 3.7 Interpreter
- Executes compiled bytecode in SEG_CODE
- Maintains instruction pointer and VM state
- Dispatches to opcode implementations
- Manages stack operations and type checking
- Implements error handling and recovery mechanisms

## 4. EXECUTION FLOW

### 4.1 System Initialization
- Memory allocation and segment setup
  - Allocation of 64KB memory block
  - Division into four 16KB segments
  - Memory protection boundaries establishment
  - Segment access permissions setup
  - Initial memory clearing for deterministic state
- Stack initialization (parameter and return stacks)
  - Parameter stack positioned in SEG_DATA
  - Return stack allocated in separate region of SEG_DATA
  - Stack pointers initialized to base addresses
  - Stack limits configured for overflow detection
  - Stack integrity verification mechanisms established
- Bootstrap core vocabulary and primitives
  - Registration of built-in operations
  - Core arithmetic functions (+, -, *, /, %)
  - Stack manipulation primitives (dup, drop, swap)
  - Memory access operations (fetch, store)
  - Control flow primitives (branch, call, exit)
- Initialize string digest and symbol table
  - Empty digest creation in SEG_STRING
  - Initial symbol table setup (empty linked list)
  - Registration of built-in word names
  - Digest hash table initialization
  - String interning system activation
- Setup execution environment (REPL or file processing)
  - Command-line argument processing
  - Input source determination
  - Output channel configuration
  - Error handling strategy selection
  - Interactive vs. batch mode decision

### 4.2 Execution Pipeline
- Source code acquisition (file or REPL input)
  - File reading for script mode
  - Line-by-line input for REPL mode
  - Input preprocessing for special commands
  - Source tracking for error reporting
  - Input buffering strategy for efficiency
- Tokenization phase converts text to token stream
  - Character-by-character lexical analysis
  - Token classification and extraction
  - Comment and whitespace filtering
  - Position tracking for debugging
  - Special token sequence detection
- Parsing phase converts tokens to bytecode
  - Token-driven recursive descent parsing
  - Grammar rule application
  - Syntactic validity verification
  - Special form recognition and handling
  - Bytecode emission during parsing
- Compilation phase resolves references and addresses
  - Symbol resolution
  - Forward reference patching
  - Branch target resolution
  - Call address determination
  - Optimization passes (if enabled)
- Execution phase runs bytecode instructions
  - Instruction pointer initialization
  - Opcode fetch-decode-execute cycle
  - Stack manipulation during execution
  - Type checking and verification
  - Error detection and handling
- Result handling displays stack output
  - Stack effect visualization
  - Result value formatting
  - Error message presentation
  - Execution statistics (optional)
  - State presentation for debugging

### 4.3 Function Call Mechanism
- Prepare arguments on parameter stack
  - Argument evaluation in caller context
  - Pass-by-value semantics
  - Type checking of arguments (optional)
  - Stack effect documentation conventions
  - No explicit parameter names or types
- Push current instruction pointer to return stack
  - Return address calculation
  - Return stack overflow checking
  - Call depth monitoring
  - Context preservation
  - Tail-call detection (if optimized)
- Set instruction pointer to function address
  - Function address resolution from symbol table
  - Direct jump to function entry point
  - No activation record or frame creation
  - Constant-time function dispatch
  - No dynamic dispatch overhead
- Execute function body until EXIT opcode
  - Sequential instruction execution
  - Stack manipulation by function body
  - Local control flow within function
  - No explicit local variable scope
  - All state changes via stack
- Restore instruction pointer from return stack
  - Return address retrieval
  - Return stack underflow checking
  - Proper nested call unwinding
  - Return to proper continuation point
  - Post-call stack consistency verification
- Continue execution at return location
  - Resume execution in caller context
  - No explicit return value passing
  - Results implicitly left on parameter stack
  - No automatic stack cleanup
  - Caller responsible for stack management
- Results left on parameter stack
  - Pass-by-value result convention
  - Multiple return values supported
  - Stack effect documentation for outputs
  - No explicit return type declarations
  - Consumer responsible for type checking

### 4.4 Error Handling
- Runtime errors detected during execution
  - Stack underflow/overflow detection
  - Type mismatch identification
  - Division by zero prevention
  - Memory access violations
  - Undefined word references
- Common errors: stack underflow, type mismatch, undefined word
  - Stack underflow: Attempting to pop from empty stack
  - Type mismatch: Operation applied to incompatible types
  - Undefined word: Reference to non-existent dictionary entry
  - Memory violation: Access outside valid boundaries
  - Reference errors: Invalid heap references
- Error propagation halts execution
  - Immediate execution termination
  - Error flag set in VM state
  - Error context information collection
  - Stack trace generation (if supported)
  - Safe VM state preservation
- Context information gathered for diagnosis
  - Current instruction pointer
  - Stack contents at error time
  - Return stack trace
  - Current word being executed
  - Token source location (if available)
- Recovery options include reset, abort, or debug
  - Full reset: Complete VM reinitialization
  - Abort: Terminate current execution but preserve dictionary
  - Debug: Enter interactive debugging mode
  - Retry: Attempt to continue with recovery action
  - Ignore: Continue execution (unsafe)

### 4.5 Bytecode Execution Model
- Instruction pointer-driven execution
  - Sequential instruction execution
  - IP incremented after each opcode fetch
  - Branch instructions modify IP directly
  - IP stored on return stack during calls
  - IP as primary execution control mechanism
- Opcode dispatch mechanism
  - Opcode lookup in dispatch table
  - Direct function pointer invocation
  - No interpretation overhead
  - Fixed-width or variable-width instructions
  - Efficient switch-case implementation
- Stack manipulation paradigm
  - Primary data flow through parameter stack
  - Operation arguments popped from stack
  - Results pushed back to stack
  - Explicit stack effect for each operation
  - Stack as central execution concept
- Data flow visualization
  - Mental model of values flowing through stack
  - Operations as stack transformations
  - Data dependencies through stack positioning
  - Execution visualization matches RPN notation
  - Stack diagram parallels execution trace
- Deterministic execution
  - Predictable instruction effects
  - No hidden state changes
  - Explicit and visible data flow
  - Reproducible execution path
  - No non-deterministic operations in core

### 4.6 Execution Optimization Strategies
- Tail call optimization
  - Recognition of tail call pattern
  - Return address reuse
  - Stack frame elimination
  - Constant space for recursive calls
  - Function composition without growth
- Inline caching
  - Frequent operation fast-path
  - Common case optimization
  - Type specialization
  - Call site optimization
  - Dynamic adaptation to execution patterns
- Bytecode optimization
  - Constant folding
  - Peephole optimization
  - Dead code elimination
  - Common subexpression elimination
  - Strength reduction
- Copy-on-write fast path
  - Single owner optimization
  - Reference counting shortcuts
  - In-place modification for unique references
  - Clone avoidance when safe
  - Performance critical for immutable data

### 4.7 Execution Debugging Support
- Stack inspection tools
  - Stack content visualization
  - Stack effect tracking
  - Stack consistency verification
  - Type checking on stack elements
  - Stack manipulation history
- Execution tracing
  - Instruction-by-instruction logging
  - Stack state recording
  - Call/return tracking
  - Performance profiling
  - Hot spot identification
- Breakpoint mechanism
  - Instruction address breakpoints
  - Conditional execution pausing
  - Interactive debugging mode
  - Step-by-step execution
  - Execution context examination
- Error diagnosis
  - Detailed error messages
  - Stack trace for errors
  - Source location correlation
  - Common error pattern detection
  - Suggested fixes for common issues
- Execution visualization
  - Graphical stack representation
  - Data flow animation
  - Call graph visualization
  - Memory usage tracking
  - Type flow analysis

## 5. LEXICAL ANALYSIS

### 5.1 Token Classification
- NUMBER: Numeric literals (integers, floats with optional sign)
  - Supports both integer forms (42, -7) and floating-point notation (3.14, -0.5)
  - No scientific notation in core language
  - Range limited by NaN-boxing constraints (18-bit integers directly represented)
  - Larger values stored as heap-allocated floats automatically
- WORD: Identifiers and word references (alphanumeric strings)
  - Case-sensitive identifiers without length limitation
  - Naming convention favors descriptive lowercase names
  - Special words (e.g., IF, ELSE) conventionally uppercase for clarity
  - Immediate execution semantics when encountered
- STRING: String literals in double quotes with escape sequences
  - Support for common escape sequences (\n, \t, \", \\)
  - Automatically interned through digest system
  - Reference equality for identical strings
- SPECIAL: Single-character operators and punctuation
  - Arithmetic operators: +, -, *, /, %
  - Comparison operators: <, >, =
- Grouping tokens: 
  - GROUP_START/END: #[ and ]# for expression isolation
  - DICT_START/END: :[ and ]: for dictionary literals
  - BLOCK_START/END: { and } for control flow blocks
  - Function definitions: : and ; for word definition boundaries
  - Code blocks: ( and ) for quotation
- WORD_QUOTE: Backtick notation for symbol literals
  - `identifier produces a symbol reference without evaluation
  - Essential for metaprogramming and dictionary operations
- Comments: Line comments with C++-style // syntax
  - No multi-line comment syntax
  - Comment detection occurs during tokenization phase
  - Comments are entirely discarded, never reaching parser

### 5.2 Tokenization Strategy
- Character-by-character scanning with categorization
  - Character classification determines token type
  - Token boundaries determined by character class transitions
  - Whitespace serves as token separator
- Context-sensitive token extraction based on leading character
  - Numeric tokens begin with digit or minus sign (followed by digit)
  - Word tokens begin with letter or underscore
  - String tokens begin with double quote
  - Symbol tokens begin with backtick
- Whitespace and comment skipping
  - Whitespace characters: space, tab, newline, carriage return
  - Comments treated as specialized whitespace (skipped)
  - Line/column tracking maintained through whitespace for error reporting
- Special multi-character sequence detection
  - Compound tokens like #[ and :[ recognized as units
  - Differentiated from individual character sequences
  - Special pattern matching for these composite tokens
- Position tracking for error reporting
  - Line and column numbers stored with each token
  - Original source position maintained through compilation
  - Error messages include precise source location
- Lookahead for ambiguity resolution
  - Single-character lookahead for disambiguation
  - Minimal lookahead philosophy for simplicity
  - Special handling for potentially ambiguous cases like '-' (negative vs. subtraction)

### 5.3 Token Stream Processing
- Token backtracking for complex parsing situations
  - Parser can "push back" tokens to reprocess them
  - Limited to single token lookahead/backtracking
  - Enables predictive parsing without full recursion
- Predictive parsing with token lookahead
  - Peek at next token without consuming
  - Determine parsing strategy based on lookahead
  - Structure recognition through token patterns
- Error recovery at token boundaries
  - Lexical errors contained at token level
  - Recovery by skipping to next recognizable token boundary
  - Detailed diagnostics for invalid token patterns
- Token source location for debugging
  - Each token tagged with original source position
  - Stack traces include token positions
  - Error reporting pinpoints exact issue location
- Direct token-to-operation mapping
  - Tokens map cleanly to semantic operations
  - No complex intermediate representation
  - One-to-one relationship between tokens and language concepts

### 5.4 Lexical State Management
- Finite state machine implementation
  - Distinct states for different token recognition phases
  - State transitions drive token boundary detection
  - Clear separation between numeric, word, and string processing
- Input buffer management
  - Character-by-character processing
  - No backtracking at character level
  - Bounded lookahead (1-2 characters maximum)
- Token stream buffering
  - Token queue for lookahead operations
  - Minimal buffering philosophy
  - Token stream as primary parser interface
- Source position tracking
  - Line counter incremented on newlines
  - Column counter reset on newlines, incremented per character
  - Position stored with each emitted token
- Error state handling
  - Lexical errors reported with context
  - Invalid character sequences identified
  - Common error patterns recognized for helpful diagnostics

### 5.5 Lexer Optimizations
- Fast-path recognition for common tokens
  - Numeric literals optimized for common case
  - Word token recognition streamlined
  - Special character handling inlined
- String literal processing
  - Escape sequence resolution during tokenization
  - String interning through digest system
  - Unique storage of identical strings
- Comment filtering
  - Comments completely eliminated during tokenization
  - Zero runtime overhead from comments
  - Source position tracking maintained through comments
- Character classification optimization
  - Character class lookup tables
  - O(1) character categorization
  - Special handling for Unicode ranges
- Token reuse strategies
  - Token objects pooled for memory efficiency
  - Field reuse for performance
  - Minimal allocations during lexing phase

### 5.6 Interaction with Parser
- Pull-based tokenization model
  - Parser requests tokens as needed
  - Lazy token production
  - On-demand processing of input stream
- Clear separation of concerns
  - Lexer responsible only for token recognition
  - No semantic analysis in lexer
  - Parser handles all language-level constructs
- Error propagation strategy
  - Lexical errors surfaced to parser
  - Parser may attempt recovery
  - Cascading error prevention
- Location information flow
  - Source locations flow from lexer to parser to compiler
  - Preserved through all stages for debugging
  - Runtime errors can reference original source positions
- Performance characteristics
  - O(n) time complexity for tokenization
  - Single-pass processing
  - Minimal memory overhead
  - Predictable performance profile

## 6. SYNTACTIC ANALYSIS

### 6.1 Parser Architecture
- Recursive descent parsing without backtracking
  - Top-down parsing approach
  - Direct implementation of grammar rules
  - Function per language construct
  - Grammar rules directly encoded in parser logic
- Direct bytecode emission (no intermediate AST)
  - Parser outputs bytecode directly to compiler
  - No explicit abstract syntax tree construction
  - Simplified compilation pipeline
  - Reduced memory overhead during compilation
- Context-sensitive parsing based on token type
  - Parser behavior determined by token classification
  - Different handling for NUMBER, WORD, STRING, etc.
  - Special processing for control structures
  - Grammar rules vary by context
- Special form recognition for control structures
  - IF/ELSE forms recognized as distinct patterns
  - Colon definitions (: name ... ;) as specialized grammar
  - Curly-brace blocks for control flow grouping
  - Parenthesized expressions for code quotation
- Stack effect verification for type safety
  - Documentation-driven approach to validation
  - Optional runtime checking of stack effects
  - Development mode can verify stack consistency
  - No static type checking in core language

### 6.2 Syntactic Structures
- Word definitions with colon notation (: word ... ;)
  - Fundamental unit of code organization
  - Named entry points in dictionary
  - Stack-based parameter passing
  - Implicit return from end of definition
  - Visibility in global dictionary namespace
- Code blocks with parentheses (( ... ))
  - First-class code values
  - Quotation of code without execution
  - Passed as data to combinators
  - Evaluated on demand with 'eval'
  - Core of functional composition model
- Control blocks with curly braces ({ ... })
  - Structured control flow delimitation
  - Used with IF/ELSE forms
  - Token grouping for execution units
  - Uniform handling of multi-token blocks
  - Clear visual separation of control structures
- Modern control structures (IF/ELSE)
  - Condition-first execution model
  - Boolean values from stack control branching
  - Structured control flow without GOTO
  - No explicit loop constructs (recursion instead)
  - Functional approach to conditional logic
- Literal forms for numbers, strings, and symbols
  - Direct representation of values in source
  - Type determination at parse time
  - Efficient bytecode generation for literals
  - Immediate vs. heap-allocated value decision
- Grouping notation for expression isolation
  - Expression boundaries with #[ ... ]#
  - Stack effect isolation
  - Nested expression organization
  - Clear visual separation of logical units
  - Prevents unintended stack interactions

### 6.3 Control Flow Handling
- Conditional branches through IF/ELSE forms
  - Pre-condition evaluation (condition on stack before IF)
  - True/false branch compilation
  - Branch offset calculation in bytecode
  - Structured approach to conditional execution
  - No goto or arbitrary jumps
- Branch offset calculation and patching
  - Forward jump address resolution
  - Backward branching for loops
  - Jump offset encoding in bytecode
  - Address patching after block compilation
  - Branch optimization for size and speed
- Forward reference resolution
  - Placeholder insertion for unknown addresses
  - Post-compilation patching with correct offsets
  - Support for recursive definitions
  - Call resolution for mutual recursion
  - Jump optimization for branch instructions
- Code block compilation with return semantics
  - Exit instruction insertion
  - Return stack management
  - Proper nesting of blocks
  - Function call/return convention
  - Tail-call optimization detection
- Nested block handling
  - Stack-based block tracking
  - Proper nesting validation
  - Block context maintenance
  - Depth tracking for optimizations
  - Error detection for malformed nesting

### 6.4 Parsing State Management
- Parser state tracking
  - Current definition context
  - Block nesting depth
  - Compilation mode flags
  - Definition boundaries
  - Special parsing contexts
- Symbol table integration
  - Name resolution during parsing
  - Definition recording
  - Symbol lookup for word references
  - Error detection for undefined symbols
  - Forward reference handling
- Error handling and recovery
  - Syntax error detection
  - Detailed diagnostic messages
  - Recovery strategies for common errors
  - Graceful failure modes
  - Context-sensitive error messages
- Compilation target management
  - Direct bytecode output
  - Branch resolution tracking
  - Address backpatching
  - Optimization hints
  - Compilation unit boundaries

### 6.5 Grammar Rule Implementation
- Program structure parsing
  - Top-level sequence of definitions and expressions
  - Root parsing entry point
  - Global context establishment
  - File-level organization
  - Main execution path
- Expression parsing
  - RPN evaluation sequence
  - Token-driven processing
  - Operator recognition
  - Literal handling
  - Word resolution
- Definition handling
  - Colon definition recognition
  - Word registration
  - Body compilation
  - Exit instruction generation
  - Symbol table update
- Block compilation strategies
  - Control blocks for IF/ELSE
  - Quotation blocks for higher-order functions
  - Dictionary and vector notation
  - Symbol and grouping constructs
  - Nested structure management

### 6.6 Special Parsing Features
- Branch resolution
  - Forward jump targets
  - Conditional branch offsets
  - Loop structures
  - Exit point calculation
  - Optimized jump encoding
- Immediate vs. compile-time words
  - Words executed during parsing
  - Compile-time evaluation
  - Parser extension through immediate words
  - Syntactic abstraction capabilities
  - Macro-like functionality
- Dictionary manipulation during parsing
  - Symbol definition
  - Word shadowing
  - Dictionary checkpoint/restore
  - Temporary definition context
  - Vocabulary management
- Vectorized operation recognition
  - Specialized handling for vector operations
  - Bulk data processing optimization
  - Stream operation compilation
  - Operation fusion opportunities
  - Data flow analysis

### 6.7 Parser Extensibility
- Parser hook points
  - Custom token handling
  - Extended syntax support
  - Parsing pipeline modification
  - Grammar rule extension
  - New syntactic forms
- Compile-time execution
  - Evaluation during parsing
  - Constant folding
  - Meta-programming support
  - Code generation facilities
  - Domain-specific syntax extensions
- Semantic action integration
  - Custom compilation strategies
  - Definition-time behavior
  - Specialized code generation
  - Optimization directives
  - Platform-specific adaptations
- Error handling customization
  - Extended diagnostics
  - Custom recovery strategies
  - Application-specific validation
  - Context-sensitive feedback
  - User-defined constraints

## 7. SYMBOL RESOLUTION

### 7.1 Symbol Table Architecture
- Linear symbol table with singly-linked structure
- Symbol lookup traverses list from newest to oldest
- Symbol shadowing allows redefinition without replacement
- No namespaces or lexical scoping - global symbol space
- Flat symbol hierarchy with simple resolution rules

### 7.2 Symbol Binding Mechanics
- Compile-time resolution for most symbols
- Dynamic lookup for indirection operations
- Symbol-to-address mapping for user-defined words
- Symbol-to-function mapping for built-in primitives
- Name representation through digest string references

### 7.3 Binding Strategies
- Early binding for most symbols at parse time
- Late binding only when explicitly requested
- No lexical closures or environment capture
- Pass-by-value semantics for all operations
- All binding information explicit in the code

### 7.4 Definition Scoping
- Global definitions visible to entire program
- Definition shadowing for evolving vocabularies
- Temporary definition contexts with mark/restore
- No local variables or lexical scoping
- Stack-based parameter passing instead of variables

### 7.5 Built-in Vocabulary
- Core operations defined at bootstrap
- Arithmetic: add, subtract, multiply, divide, modulo
- Stack manipulation: dup, drop, swap, over, rot
- Logic: and, or, not, equals, greater, less
- Memory: store, fetch, allocate, free
- No privileged operations - everything is a word

### 7.6 Definition Mechanics
- Colon definitions create new dictionary entries
- Branch compilation to skip over definition body
- Exit instruction at end of definition
- Tail-call optimization for recursive definitions
- No automatic stack effect checking (documentation only)

### 7.7 Symbol Table Evolution
- Linear growth with program complexity
- No garbage collection of unused symbols
- Shadowing instead of replacement
- Context reversion through mark/restore
- Bootstrap vocabulary provides foundation

### 7.8 Symbol Resolution Performance
- O(n) worst case for symbol lookup (linear scan)
- Most common words found near head of list
- Symbol addresses cached when possible
- String interning ensures fast name comparison
- Predictable resolution overhead

## 8. SYNTAX ELEMENTS

### 8.1 Fundamental Syntax Philosophy
- Clean, minimalist syntax reflecting stack semantics
- Postfix notation eliminating parsing ambiguity
- Whitespace as token separator, not structural element
- No expression precedence rules needed
- Consistent left-to-right evaluation order
- Syntax reinforces the mental model of data flow

### 8.2 Literal Forms
- Numbers: Integer and floating-point literals
  - Examples: 42, -7, 3.14, -0.5
- Strings: Double-quoted text with escapes
  - Examples: "hello", "line\nbreak"
- Symbols: Backtick-prefixed identifiers
  - Example: `mySymbol (literal symbol, not evaluation)

### 8.3 Word References
- Bare identifiers reference dictionary entries
- Case-sensitive identifiers
- Alphanumeric characters plus underscore
- Evaluated immediately when encountered
- Arguments consumed from stack, results pushed to stack

### 8.4 RPN Arithmetic
- Operands pushed before operators
- Example: 5 3 + (equals 8)
- Complex expressions: 10 5 - 2 * (equals 10)
- Eliminates need for parentheses in most cases
- Stack visualization matches evaluation order

### 8.5 Definition Syntax
- Colon definitions: : name body ;
- Example: : square dup * ;
- Creates named operation in dictionary
- Body compiled for later execution
- Definition exits automatically at semicolon

### 8.6 Code Blocks
- Parenthesized expressions: ( ... )
- Creates executable but inactive code block
- Can be passed as data
- Executed with 'eval' or combinator words
- Essential for higher-order functions

### 8.7 Control Structures
- IF/ELSE based on stack condition:
  - Example: condition IF {true-code} ELSE {false-code}
- Curly braces required for block demarcation
- Condition evaluated before IF keyword
- No WHILE loops - recursion used instead
- Functional approach to iteration via combinators

### 8.8 Data Structure Notation
- Vectors: [ elem1 elem2 ... ]
- Sequences: Implementation-defined iteration sources
- Dictionaries: :[ key1 value1 key2 value2 ... ]:
- Grouping notation: #[ ... ]# for expression isolation
- All structures are immutable

### 8.9 Comments
- C++-style line comments with //
- Example: // This is a comment
- No block comments in base syntax
- Comments completely ignored by parser
- Used for documentation, not semantic content

### 8.10 Stack Effect Notation
- Documentation convention: ( inputs -- outputs )
- Example: square ( n -- n² )
- Not enforced by the language, only documentary
- Essential for understanding word behavior
- Inputs listed from bottom to top of stack
- Outputs listed from bottom to top of stack

### 8.11 Combinators
- Higher-order functions taking code blocks as arguments
- map: Apply function to each element 
- filter: Select elements matching predicate
- reduce: Combine elements with binary function
- dip: Execute block temporarily hiding top of stack
- Enables functional programming patterns

### 8.12 Quotation
- Backtick for symbol quotation: `word
- Parentheses for code quotation: ( code )
- Essential for metaprogramming
- Allows words and code to be treated as data
- Foundation for combinator-based programming

## 9. TYPE SYSTEM

### 9.1 NaN-Boxing Type Representation
- All values represented in 32-bit patterns
- IEEE-754 NaN pattern repurposed for type tagging
- Real floating point values represented normally
- Type tags embedded in quiet NaN bit pattern
- Zero memory overhead for type information

### 9.2 Core Types
- NUMBER: Direct integer up to 18 bits
- FLOAT: IEEE-754 floating point (indirectly referenced)
- POINTER: Reference to heap-allocated structure
- SYMBOL: References to interned strings
- BOOLEAN: True/false logical values
- UNDEFINED: Null/undefined placeholder
- VECTOR: Fixed-length array of values
- SEQUENCE: Iteration state for lazy sequences
- DICTIONARY: Key-value mapping structure

### 9.3 Type Checking
- Dynamic typing with runtime verification
- Explicit checks before operations
- Type errors abort execution with diagnostics
- No static type checking or inference
- Type information carried with values, not variables

### 9.4 Type Conversions
- Explicit conversions through conversion words
- No implicit type coercion
- Examples: >float, >int, >string
- Type predicates: float?, int?, string?
- Consistent handling of edge cases

## 10. HEAP MANAGEMENT

### 10.1 Block Allocation
- Fixed-size blocks of 64 bytes
- Header contains reference count and type
- First-fit allocation strategy
- Free list for recycling released blocks
- No block splitting or coalescing

### 10.2 Reference Counting
- Each block tracks its reference count
- References incremented on assignment/storage
- References decremented when variables go out of scope
- Block released to free list at zero references
- No cycle detection (acyclic data only)

### 10.3 Copy-on-Write
- Shared structures not modified in place
- Modified copies created for multi-referenced blocks
- Single-owner optimization for performance
- Ensures immutability and thread safety
- Enables efficient structural sharing

### 10.4 Block Types
- FLOAT: Storage for IEEE-754 values
- VECTOR: Fixed-length array with elements
- STRING: Mutable string storage (distinct from interned strings)
- DICTIONARY: Key-value storage with string keys
- SEQUENCE: Iteration state for lazy sequences
- CODE: Compiled code block for execution
- ARRAY: Generic array with length header

### 10.5 Memory Efficiency
- Fixed block size eliminates fragmentation
- Structural sharing reduces memory footprint
- Copy-on-write minimizes copying overhead
- Reference counting provides deterministic cleanup
- No GC pauses or memory churn

## 11. SEQUENCE ABSTRACTION

### 11.1 Iterator Protocol
- Unified sequence iteration pattern
- next() operation returns {value, done} pair
- Lazy evaluation for on-demand processing
- Memory-efficient processing of large datasets
- Support for infinite sequences

### 11.2 Sequence Types
- VectorSequence: Iteration over vector elements
- RangeSequence: Numeric ranges without materialization
- StringSequence: Character-by-character iteration
- MapSequence: Transformed view of source sequence
- FilterSequence: Filtered view of source sequence
- Implementation through tagged sequence state

### 11.3 Sequence Operations
- map: Transform each element
- filter: Select matching elements
- reduce: Combine elements with binary function
- take: Limit sequence length
- drop: Skip initial elements
- Composition of operations remains lazy

### 11.4 Lazy Evaluation
- Operations compose without intermediate collections
- Elements processed only when consumed
- Chains short-circuit on first terminal operation
- Reduces memory pressure and improves performance
- Enables work with potentially infinite sequences

## 12. IMPLEMENTATION GAPS

### 12.1 Local Variables
- Not implemented in current version
- Future specification in local-symbols.md
- Would provide lexically-scoped temporary bindings
- Alternative to stack manipulation for readability
- Implementation would use stack frames

### 12.2 Deferred Execution
- Partially implemented
- Allows evaluation postponement
- Thunks as suspended computations
- Foundation for lazy evaluation
- Not fully integrated with core language

### 12.3 Cooperative Multitasking
- Future specification in tasks.md
- Would enable concurrent execution
- Explicit yield points for task switching
- No preemption or true parallelism
- Cooperative scheduling model

### 12.4 Polymorphism
- Basic implementation only
- Interface-based method dispatch
- No inheritance hierarchy
- Duck typing for operation dispatch
- Method resolution through symbol lookup

## 13. RELEVANT FILES

### 13.1 Core VM
- vm.ts: Central state container and VM definition
- memory.ts: Segmented memory management
- tagged.ts: NaN-boxing type implementation
- compiler.ts: Bytecode generation

### 13.2 Language Processing
- tokenizer.ts: Lexical analysis
- parser.ts: Syntactic analysis
- interpreter.ts: Bytecode execution
- repl.ts: Interactive environment

### 13.3 Operations
- opcodes.ts: Bytecode operation definitions
- builtins.ts: Core vocabulary implementation
- define-builtins.ts: Primitive word registration

### 13.4 Memory Management
- block.ts: Heap block allocation
- vector.ts: Vector data structure

### 13.5 String Processing
- digest.ts: String interning pool
- symbol-table.ts: Word definition registry

### 13.6 Sequences
- sequence.ts: Iterator protocol definition
- range.ts: Numeric range implementation

## 14. FUTURE DIRECTIONS

### 14.1 Cooperative Multitasking
- Task abstraction with yield points
- Cooperative scheduler implementation
- Task communication primitives
- No preemption or parallelism
- Event-driven programming model

### 14.2 Lexical Scoping
- Local variable bindings
- Stack frame management
- Lexical context capture
- Improved code readability
- Performance optimizations

### 14.3 Interface-Based Polymorphism
- Method dispatch by interface
- Runtime interface checking
- Duck typing for flexibility
- Protocol-oriented design
- No inheritance or subtyping

### 14.4 Enhanced Type System
- Interface bits in NaN-boxing
- Richer type predicates
- Gradual typing options
- Type inference hints
- Better error diagnosis
