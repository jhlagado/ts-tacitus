# Tagged Values in Tacit

## Table of Contents

- [1. Introduction](#1-introduction)
- [2. NaN Boxing Approach](#2-nan-boxing-approach)
  - [2.1 IEEE 754 Float32 Structure](#21-ieee-754-float32-structure)
  - [2.2 Tacit's NaN Boxing Implementation](#22-tacits-nan-boxing-implementation)
  - [2.3 Bit Layout](#23-bit-layout)
  - [2.4 Segment Encoding](#24-segment-encoding)
- [3. Core Tag Types](#3-core-tag-types)
  - [3.1 Number Tag](#31-number-tag)
  - [3.2 Integer Tag](#32-integer-tag)
  - [3.3 Code Tag](#33-code-tag)
  - [3.4 String Tag](#34-string-tag)
  - [3.5 Special Values](#35-special-values)
- [4. Buffer and Tuple Tags](#4-buffer-and-tuple-tags)
  - [4.1 Buffer Tags](#41-buffer-tags)
  - [4.2 View Tags](#42-view-tags)
  - [4.3 Tuple Tags](#43-tuple-tags)
- [5. Implementation Details](#5-implementation-details)
  - [5.1 Encoding Tagged Values](#51-encoding-tagged-values)
  - [5.2 Decoding Tagged Values](#52-decoding-tagged-values)
  - [5.3 Tag Checking](#53-tag-checking)
  - [5.4 Segment Validation](#54-segment-validation)
- [6. Future Extensions](#6-future-extensions)

## 1. Introduction

Tacit uses a uniform value representation based on 32-bit floating-point numbers (Float32) to represent all data types in the language. Rather than using different storage formats for different types, Tacit employs a technique called "NaN boxing" to embed type information directly into the floating-point representation.

NaN boxing leverages the fact that IEEE 754 floating-point format has many bit patterns that represent NaN (Not-a-Number). Since these patterns are not used for normal numerical operations, they can be repurposed to encode other data types, including integers, references, and tagged control values.

This document describes how Tacit implements tagged values through NaN boxing, the layout of the bits, and how different types are represented. It also covers special cases like NIL, tuple tags, and the relationship between tagged values and Tacit's buffer system.

## 2. NaN Boxing Approach

### 2.1 IEEE 754 Float32 Structure

The IEEE 754 standard for 32-bit floating-point numbers defines the following bit structure:

```
 31 30      23 22                    0
+--+----------+----------------------+
|S | Exponent |       Mantissa       |
+--+----------+----------------------+
```

Where:
- Bit 31: Sign bit (S)
- Bits 30-23: 8-bit exponent
- Bits 22-0: 23-bit mantissa (fraction)

A value is considered NaN when:
1. All exponent bits are set to 1 (0xFF)
2. At least one mantissa bit is non-zero

IEEE 754 further distinguishes between "quiet NaNs" (which propagate through calculations without raising exceptions) and "signaling NaNs" (which trigger exceptions). The highest bit of the mantissa (bit 22) typically distinguishes these: 1 for quiet NaN, 0 for signaling NaN.

### 2.2 Tacit's NaN Boxing Implementation

Tacit's NaN boxing scheme uses the following structure:

1. **Sign Bit (Bit 31)**: Not used for traditional signed/unsigned distinction but reserved for future use. Currently cleared to 0 for core values.
2. **Exponent (Bits 30-23)**: Set to all 1s (0xFF) to ensure the number is a NaN.
3. **NaN Bit (Bit 22)**: Set to 1 to indicate a quiet NaN.
4. **Tag Bits (Bits 21-16)**: 6 bits represent the type tag, allowing for up to 64 distinct types.
5. **Value Bits (Bits 15-0)**: 16 bits representing the actual value or payload.

This scheme allows Tacit to:
- Use standard floating-point numbers when needed
- Encode small integers directly (-32,768 to 32,767)
- Reference string constants, code blocks, and other structures
- Support tuple tags, views, and buffer references through the tag system

### 2.3 Bit Layout

The complete bit layout for a NaN-boxed value in Tacit:

```
 31 30      23 22 21    16 15        0
+--+----------+--+--------+-----------+
|S | 11111111 |1 |  Tag   |   Value   |
+--+----------+--+--------+-----------+
```

Every valid tagged value is a quiet NaN when interpreted as an IEEE 754 float. When Tacit encounters a normal floating-point number (not a NaN), it treats it as a native NUMBER value with no tag.

### 2.4 Segment Encoding

For reference-type values that point to memory locations, Tacit encodes segment information within the tag to enable memory safety and lifetime enforcement. The segment encoding uses a subset of the tag bits to identify which memory segment contains the referenced value:

```
 21    19 18    16
+--------+--------+
|Segment |Base Tag|
+--------+--------+
```

The canonical segment types in Tacit are:

- **STACK** (000) - Local frame-based storage with ephemeral lifetime
- **DATA** (001) - Optional second stack for specialized data management
- **GLOBAL** (010) - Program-wide persistent storage 
- **STRING** (011) - Immutable interned string storage
- **CODE** (100) - Static program code and constants
- **HEAP** (101) - Dynamically allocated memory with explicit lifetime

Segment encoding is a critical part of Tacit's memory safety mechanism. It ensures that references cannot outlive their intended scope (e.g., stack values cannot be stored in global variables) and enables immutability enforcement (e.g., code segment values cannot be modified).

## 3. Core Tag Types

Tacit defines several core tag types that don't require heap allocation:

### 3.1 Number Tag

- **Tag Value**: 0
- **Description**: Represents standard floating-point numbers.
- **Value Interpretation**: For tagged numbers with this type, the value field may contain an index or reference to the actual number stored elsewhere, as the 16-bit value field is too small to hold a full floating-point number.
- **Special Case**: When a Float32 value is not a NaN, it's automatically interpreted as a NUMBER type without requiring tagging.

### 3.2 Integer Tag

- **Tag Value**: 1
- **Description**: Represents small integers that fit within 16 bits.
- **Value Interpretation**: The value field is treated as a signed 16-bit integer, allowing values from -32,768 to 32,767.
- **Special Case**: The NIL value is defined as an INTEGER tag with a value of 0.

### 3.3 Code Tag

- **Tag Value**: 2
- **Description**: Represents executable code stored in the code segment.
- **Value Interpretation**: The value field contains an index or offset into the code segment where the executable code is stored.

### 3.4 String Tag

- **Tag Value**: 3
- **Description**: Represents string literals stored in the string digest/table.
- **Value Interpretation**: The value field contains an index or identifier for looking up the string in the string table.

### 3.5 Special Values

Tacit defines special values using the tagging system:

- **NIL**: Represented as an INTEGER tag (1) with value 0, indicating the absence of a value.
- **Boolean Values**: Can be represented as INTEGER tag with values 0 (false) and 1 (true).
- **Sentinel Values**: Special markers used for control flow or to indicate boundaries can be encoded using specific tag and value combinations.

## 4. Buffer and Tuple Tags

### 4.1 Buffer Tags

- **BUFFER** (Tag Value: 4): A reference to a multivalued object with header information.

Buffers are contiguous collections of values with a header tag that describes the buffer's properties. The buffer tag is a 32-bit tagged value at the beginning of the buffer that encodes:

- 4 bits: Tag type (BUFFER)
- 16 bits: Buffer size in values (up to 64K values)
- 3 bits: Metadata count (0-7 entries)
- 9 bits: NaN boxing bits (required for tagged value encoding)

Buffer memory layout follows this pattern:
```
[BUFFER tag, metadata entries (0-7), content values...]
```

The buffer metadata entries can include:
- View references (defining how to interpret the buffer)
- Stack pointers (for stack-like buffer behavior)
- Cursors (tracking position in stream-like structures)
- Custom pointers (for application-specific purposes)

Each buffer reference also encodes segment information, indicating which memory segment (STACK, HEAP, CODE, etc.) contains the buffer. This enables memory safety enforcement at runtime while maintaining a unified approach to different buffer structures (arrays, records, tables, stacks, queues).

### 4.2 View Tag

- **VIEW** (Tag Value: 5): Represents a function that interprets buffer contents.

Views are composable functions that translate indices or keys to memory offsets, enabling different interpretations of the same underlying buffer data. A view might interpret a buffer as:

- A multi-dimensional array (using shape information)
- A record (mapping field names to offsets)
- A table (combining records with array capabilities)
- A slice (providing a window into a larger buffer)
- A stack or queue (using control pointers in the metadata)

Views enable zero-copy transformations and compositional data structures, making them a core part of Tacit's memory model.

### 4.3 Tuple Tags

- **TUPLE** (Tag Value: 7): A footer tag that indicates the length of a tuple (previously called "span pointer").

In Tacit, a tuple tag is placed at the end of a group of values to mark them as a tuple. It encodes:

- The TUPLE tag type (7)
- The segment where the tuple resides (STACK, HEAP, etc.)
- The count of values in the tuple

A 3-element tuple would have this structure:

```
[value1, value2, value3, TUPLE:3]
```

Where TUPLE:3 is the tuple tag that indicates the preceding 3 values form a tuple. This tag enables:
- Efficient backward traversal (by knowing how many values to skip)
- Memory safety through segment identification
- Tuple manipulation and polymorphism

Tuple tags (like buffer tags) are tagged values themselves. While buffer tags appear at the beginning of buffers as headers, tuple tags appear at the end of tuples as footers. References to either buffers or tuples encode segment information, allowing the system to enforce memory safety without needing to know the internal structure of what's being referenced.

## 5. Implementation Details

### 5.1 Encoding Tagged Values

Tagged values are encoded using bit manipulation operations:

1. Validate the tag is within the appropriate range
2. Validate the value fits within the 16-bit range
3. Combine the sign bit, exponent mask, NaN bit, tag bits, and value bits
4. Interpret the resulting bit pattern as a Float32

This conversion ensures that all tagged values appear as NaNs when used in floating-point contexts, allowing them to flow through arithmetic operations safely.

### 5.2 Decoding Tagged Values

Tagged values are decoded by:

1. Checking if the value is a regular number (not NaN)
2. If it's a NaN, extracting the individual components:
   - Tag bits from positions 16-21
   - Value bits from positions 0-15
   - Sign bit from position 31
3. Interpreting the value based on its tag

### 5.3 Tag Checking

Tacit provides efficient functions for checking the tag of a value:

- Testing if a value has a specific tag
- Extracting just the tag portion
- Extracting just the value portion
- Testing for special values like NIL

These operations are designed to be fast and inlinable, minimizing the overhead of the tagging system during execution.

### 5.4 Segment Validation

When performing operations that manipulate references, Tacit validates segment compatibility to ensure memory safety:

1. **Assignment Validation**: When assigning a reference to a variable, the system checks if the referenced segment is compatible with the variable's scope
2. **Access Validation**: Before accessing data through a reference, the system confirms the segment is valid and accessible
3. **Mutation Validation**: Before modifying data, the system verifies the segment permits mutation (e.g., CODE segment data cannot be modified)

These validation checks occur at runtime and generate appropriate errors when violations are detected:

- Storing a STACK reference in a GLOBAL variable (lifetime violation)
- Attempting to modify CODE segment data (immutability violation)
- Using a reference after its segment has been deallocated (dangling reference)

Segment validation is a key part of Tacit's memory safety guarantees and operates alongside the tagging system to prevent common memory errors.

## 6. Future Extensions

The Tacit tagging system has room for expansion:

1. **Additional Tag Bits**: Only 6 of the 23 mantissa bits are currently used for tags, allowing for future extension of the tag space.
2. **Sign Bit Usage**: The sign bit could be repurposed for additional type information or to distinguish different categories of tags.
3. **Extended Value Range**: For specific tag types, the value field could be extended beyond 16 bits by using some of the unused mantissa bits.
4. **Direct Encoding**: Some small floating-point values could be encoded directly in the mantissa rather than by reference.

These extensions would maintain compatibility with the IEEE 754 NaN boxing approach while providing more flexibility for representing different data types.

The tagging system is a core part of Tacit's design, enabling a unified value representation that supports both primitive types and complex data structures while maintaining efficiency and minimizing memory overhead.
