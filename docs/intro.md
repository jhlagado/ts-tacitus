> # Deprecation Notice  
> This document has been superseded by [architecture.md].  
> Retained for historical reference only.  
> Current system overview: [See architecture.md §1-3]

# Tacit Language Design Overview

Based on the provided information about Tacit, I can outline its key design principles and implementation details:

## Core Execution Model

Tacit uses Reverse Polish Notation (RPN) syntax, where code is executed as it's encountered. This stack-based approach means:

- Operations consume values from the stack and push results back
- Code blocks must be deferred when used as arguments (e.g., `[ 1 2 3 ] { + } reduce`)
- No variadic functions due to absence of stack frames

## Data Types

- Numbers: Primary data type, used for calculations and as booleans (0=false, 1=true)
- Strings: Simple intern system, less emphasized than numbers and arrays
- Characters: Represented as numeric values
- Arrays: Nested vectors (not multidimensional arrays like APL/J)
- Dictionaries: Arrays of alternating key-value pairs, optimized when sorted
- Tables: Dictionaries where values are column vectors

## Memory Management

- Block-Based Heap: Uses 64-byte blocks with reference counting
- Immutable Data Structures: All data structures are immutable with structural sharing
- Copy-on-Write: Only modified blocks are copied, preserving shared structure
- NaN-Boxing: Tagged values encode type information in NaN float patterns

## Sequences

Sequences are a key abstraction for processing collections:

- Lazy Evaluation: Defer realization of full data structures until needed
- Memory Efficiency: Avoid allocations during transformations
- Sources: Generate from ranges, strings, vectors, or multiple sequences
- Processors: Transform elements via map, filter, scan operations
- Sinks: Consume sequences to produce final results (reduce, toVector)

## Functional Programming

- No Loops: Iteration happens through sequences and functional operations
- No Variables: State is managed on the stack or in data structures
- No Closures: Functions don't capture their environment
- Higher-Order Functions: Functions can take functions as arguments

## Implementation Details

- Block-Based Addressing: 16-bit pointers refer to block indices, not byte offsets
- Reference Counting: Explicit memory management without garbage collection
- Tagged Values: NaN-boxing scheme for type information
- Sequence Abstraction: Unified interface for collection processing

## Planned Enhancements

- Parser Improvements: Priority for development
- I/O Operations: Console and file I/O
- Dictionary Optimization: Fast lookups for sorted dictionaries
- Table Processing: Efficient operations on tabular data
