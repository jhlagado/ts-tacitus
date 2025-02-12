# Sequence Management in Tacit

## Overview

The `seq` directory in the Tacit codebase is responsible for managing sequences, which are a fundamental concept in the language. Sequences provide a way to work with collections of data in a functional and efficient manner, supporting operations such as mapping, filtering, and reducing. This documentation will cover the key components and design decisions behind sequence management in Tacit.

## Key Features

### Sequence Sources

- **Source Sequences**: The `source.ts` file defines functions for creating sequences from various sources, such as vectors and views. These sequences serve as the base for further processing.
- **Functions**:
  - `seqFromView`: Creates a sequence from a 1D view.
  - `seqFromRange`: Creates a sequence from a range of numbers.

### Sequence Processors

- **Processor Sequences**: The `processor.ts` file defines functions for creating processor sequences that apply mapping or filtering functions to each element. These sequences allow for efficient manipulation of data.
- **Functions**:
  - `seqMap`: Creates a sequence that applies a mapping function to each element.
  - `seqFilter`: Creates a sequence that filters elements based on a predicate function.
  - `seqNextProcessor`: Retrieves the next element from a processor sequence, applying the mapping or filtering function as needed.

### Sequence Sinks

- **Sink Sequences**: The `sink.ts` file defines functions for consuming sequences and reducing them to a single value or collecting them into an array. These sequences provide a way to aggregate and process data efficiently.
- **Functions**:
  - `seqReduce`: Reduces a sequence to a single value using a reducer function.
  - `seqRealize`: Converts a sequence into a JavaScript array.
  - `seqForEach`: Applies a consumer function to each element in a sequence.

## Detailed Components

### Sequence Sources

#### `seqFromView`

- **Function**: `seqFromView`
- **Description**: Creates a sequence from a 1D view. The view serves as the base for the sequence, and the sequence allows for efficient access to the view's data.
- **Error Handling**: Returns `UNDEF` if the view is not 1-dimensional or if the view pointer is invalid.

#### `seqFromRange`

- **Function**: `seqFromRange`
- **Description**: Creates a sequence from a range of numbers. This function is useful for generating sequences for testing and demonstration purposes.
- **Error Handling**: Returns `UNDEF` if the input range is invalid or if memory allocation fails.

### Sequence Processors

#### `seqMap`

- **Function**: `seqMap`
- **Description**: Creates a sequence that applies a mapping function to each element. The mapping function is applied as the sequence is consumed, transforming each element accordingly.
- **Error Handling**: Returns `UNDEF` if the source sequence is invalid or if the mapping function is not provided.

#### `seqFilter`

- **Function**: `seqFilter`
- **Description**: Creates a sequence that filters elements based on a predicate function. Only elements that satisfy the predicate are included in the resulting sequence.
- **Error Handling**: Returns `UNDEF` if the source sequence is invalid or if the predicate function is not provided.

#### `seqNextProcessor`

- **Function**: `seqNextProcessor`
- **Description**: Retrieves the next element from a processor sequence, applying the mapping or filtering function as needed. This function is crucial for consuming processor sequences efficiently.
- **Error Handling**: Returns `UNDEF` if the processor sequence is invalid or if the mapping/filtering function is not provided.

### Sequence Sinks

#### `seqReduce`

- **Function**: `seqReduce`
- **Description**: Reduces a sequence to a single value using a reducer function. The reducer function is applied to each element in the sequence, aggregating them into a single value.
- **Error Handling**: Returns `UNDEF` if the source sequence is invalid or if the reducer function is not provided.

#### `seqRealize`

- **Function**: `seqRealize`
- **Description**: Converts a sequence into a JavaScript array. This function is useful for inspecting the contents of a sequence and for further processing in JavaScript.
- **Error Handling**: Returns `UNDEF` if the source sequence is invalid.

#### `seqForEach`

- **Function**: `seqForEach`
- **Description**: Applies a consumer function to each element in a sequence. This function is useful for performing side effects or aggregating data from a sequence.
- **Error Handling**: Returns `UNDEF` if the source sequence is invalid or if the consumer function is not provided.

## Design Decisions

### Flexible Data Access

- Sequences provide a flexible way to access and manipulate collections of data. This is crucial for array programming languages like Tacit, where operations on subsets of data are common.

### Multi-Dimensional Support

- Supporting multi-dimensional sequences allows for complex data manipulations, such as working with matrices and higher-dimensional arrays.
- The row-major order stride calculation ensures that data access is efficient and intuitive.

### Structural Sharing

- Structural sharing allows sequences to share the structure of unmodified blocks, reducing memory usage and preventing unnecessary copying.
- This approach is inspired by persistent data structures and is essential for maintaining immutability and efficient memory use.

### Error Handling

- Functions return `UNDEF` in case of errors, allowing for graceful error handling in the language. This ensures that the system can handle errors without crashing, which is crucial for robustness.

## Conclusion

The `seq` directory is a critical component of the Tacit programming language, providing efficient management of sequences. Its design decisions, such as flexible data access, multi-dimensional support, structural sharing, and error handling, are tailored to the needs of a restrictive system, ensuring efficient memory use and robustness.
