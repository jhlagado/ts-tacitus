# Table of Contents

- [Records and Tables](#records-and-tables)
  - [1. Introduction](#1-introduction)
    - [1.1. Core Concepts](#11-core-concepts)
    - [1.2. Function Composition as the Unifying Principle](#12-function-composition-as-the-unifying-principle)
  - [2. Record Views – Translating Symbols to Offsets](#2-record-views--translating-symbols-to-offsets)
    - [2.1. The Record View as Function](#21-the-record-view-as-function)
    - [2.2. Record View Implementation](#22-record-view-implementation)
    - [2.3. Symbol Interning and Performance](#23-symbol-interning-and-performance)
    - [2.4. Record View Composition](#24-record-view-composition)
    - [2.5. Performance and Optimization](#25-performance-and-optimization)
  - [3. Tables – Composing Record Views with Buffers](#3-tables--composing-record-views-with-buffers)
    - [3.1. Tables as Records of Values](#31-tables-as-records-of-values)
    - [3.2. Buffer + Record View = Table](#32-buffer--record-view--table)
    - [3.3. Schema Definition and Layout](#33-schema-definition-and-layout)
    - [3.4. Access Patterns and Optimization](#34-access-patterns-and-optimization)
  - [4. Hybrid Access Models](#4-hybrid-access-models)
    - [4.1. Row-Oriented Tables (Array of Records)](#41-row-oriented-tables-array-of-records)
    - [4.2. Column-Oriented Tables (Record of Arrays)](#42-column-oriented-tables-record-of-arrays)
    - [4.3. Unified Access Interface](#43-unified-access-interface)
    - [4.4. Performance Characteristics](#44-performance-characteristics)
  - [5. Composing Arrays and Records](#5-composing-arrays-and-records)
    - [5.1. Nested Records and Arrays](#51-nested-records-and-arrays)
    - [5.2. Slicing and Reshaping Tables](#52-slicing-and-reshaping-tables)
    - [5.3. Zero-Copy Transformations](#53-zero-copy-transformations)
    - [5.4. Combining Symbolic and Numeric Access](#54-combining-symbolic-and-numeric-access)
  - [6. Practical Applications](#6-practical-applications)
    - [6.1. Data Processing Pipelines](#61-data-processing-pipelines)
    - [6.2. Schema Evolution and Migration](#62-schema-evolution-and-migration)
    - [6.3. Real-World Examples](#63-real-world-examples)
  - [7. Performance Notes](#7-performance-notes)
    - [7.1. Memory Layout and Locality](#71-memory-layout-and-locality)
    - [7.2. View Function Optimization](#72-view-function-optimization)
    - [7.3. Cache-Friendly Access Patterns](#73-cache-friendly-access-patterns)
  - [8. Conclusion](#8-conclusion)
    - [8.1. Unified View Model](#81-unified-view-model)
    - [8.2. Composition as Fundamental Principle](#82-composition-as-fundamental-principle)

# Records and Tables

## 1. Introduction

Tacit's records and tables provide a powerful, composable mechanism for symbolic data access that complements its array system while maintaining the same fundamental design philosophy. Rather than introducing new language constructs or specialized containers, Tacit extends its core buffer-and-view model with symbolic indexing, enabling rich data structures through simple function composition.

This document defines the canonical model for records and tables in Tacit, exploring how symbolic views work alongside numeric ones to create a unified, predictable interface for data of any shape or indexing scheme. By understanding records as view functions—just like array views but operating on symbols instead of indices—we reveal the elegant simplicity underlying Tacit's approach to data representation.

### 1.1. Core Concepts

At the heart of Tacit's record system are three fundamental ideas that mirror its array model:

1. **Buffers** provide raw storage—contiguous memory blocks holding fixed-width elements. These are the same buffers used throughout Tacit, with no special "record buffer" type.

2. **Record views** are functions that translate symbolic names to indices. Just as array views map numeric indices to memory locations, record views map symbols (column names) to positions within an array axis.

3. **Tables** emerge when numeric arrays are combined with record views. This combination creates a data structure where one axis is indexed by symbols rather than numbers, enabling named column access.

The parallel with arrays is exact and intentional:

```
Array + Numeric View = Array with numeric indices
Array + Record View = Table with named columns
```

This symmetry enables a unified mental model where arrays and tables differ only in how their axes are addressed: by position or by name.

### 1.2. Function Composition as the Unifying Principle

Composition is the foundational principle behind Tacit's data model. By expressing both numeric and symbolic access as ordinary view functions, Tacit enables seamless combination of different access patterns:

- A record view can be composed with an array view to create a table with hybrid access
- Multiple record views can be stacked to represent nested data structures
- View functions can transform between different access patterns without moving data

This compositional approach yields tremendous flexibility with minimal machinery. There are no special record types, table classes, or hidden allocators—just functions composed to interpret bytes according to the programmer's needs.

The following sections explore how this simple yet powerful model enables everything from basic records to sophisticated data tables, all while maintaining Tacit's commitment to stack discipline, minimal overhead, and predictable performance.

## 2. Record Views – Translating Symbols to Indices

At the core of Tacit's record system is the record view—a function that translates symbolic column names to array indices. This section explores how record views work, their implementation, and their performance characteristics.

### 2.1. The Record View as Function

A record view is fundamentally a function with the stack signature:

```
( symbol array -- index )
```

When provided with a symbol (column name) and an array reference, it returns the index position where the corresponding column can be found. This pattern complements array views, which typically map multiple indices to memory locations.

Record views are installed as do-pointers in array headers, allowing direct invocation with the following pattern:

```
'column-name my-table       ( -- column-data )
```

Here, the symbol `'column-name` is pushed onto the stack, followed by a reference to `my-table`. The table's do-pointer executes, consuming both and computing the appropriate index. This index is then used to access the column data.

Crucially, record views are ordinary Tacit words. They can be examined, composed, passed as arguments, returned from functions, or manipulated like any other function. This orthogonality is key to Tacit's compositional design.

### 2.2. Record View Implementation

A record view typically works by consulting a column name table that maps symbols to indices. In its simplest form, this table is a sequence of entries containing:

```
[ column-count
  symbol₀ index₀ type₀ tag₀
  symbol₁ index₁ type₁ tag₁
  ...
]
```

Where:
- `symbol` is a pointer to an interned symbol
- `index` is the column index in the table
- `type` indicates the data type of the column
- `tag` contains additional metadata flags

The record view locates the requested symbol in this table and returns the corresponding index. For efficiency, the column name table itself is typically stored as a separate shared buffer that can be reused across multiple table instances.

Tacit provides two main approaches for implementing record views:

1. **Direct table scanning**: The view function performs a linear or binary search through the column name table to find the matching symbol. This is simple and works well for tables with a modest number of columns.

2. **Compiled access functions**: For static schema definitions known at compile time, Tacit can generate specialized view functions that contain direct index lookups, avoiding table scans entirely.

### 2.3. Symbol Interning and Performance

Symbols in Tacit are interned—each unique string exists exactly once in memory, allowing symbol comparison to be implemented as simple pointer equality. This means that record views can identify columns by comparing memory addresses rather than string contents, significantly accelerating lookups.

For typical table sizes (fewer than a dozen columns), a simple linear scan through the column name table is remarkably efficient:

1. Each comparison is a single pointer comparison rather than a string equality check
2. Column name tables are small enough to fit entirely in CPU cache
3. The access pattern is predictable, allowing for effective prefetching

For larger tables, record views can automatically switch to binary search, which provides O(log n) lookup time instead of O(n). However, measurements show that for most real-world cases (tables with fewer than 32 columns), the simplicity and cache-friendliness of linear scanning often outperforms more complex approaches.

### 2.4. Record View Composition

Like array views, record views can be composed to create more complex access patterns:

1. **Nested tables**: A record view can return another table instead of a primitive array, allowing dot-notation-like access: `data 'population 'by-age`

2. **Transformation views**: A record view can perform computations on columns, such as unit conversions or format transformations

3. **Virtual columns**: A record view can synthesize columns that don't physically exist in the underlying arrays, computing them on demand from other columns

4. **Projection views**: A record view can present a subset of columns from a larger table, creating a focused interface

These compositions are implemented as ordinary function composition, with each view in the chain transforming the results from the previous one. This makes the pattern both powerful and predictable.

### 2.5. Performance and Optimization

Record views achieve high performance through several optimization strategies:

**Static binding** eliminates lookups for schemas known at compile time. When a table schema is declared statically, Tacit can generate view functions with hard-coded index mappings, allowing direct access to columns without any runtime lookup overhead.

**Column locality** in column-oriented tables minimizes cache misses. Columns that are frequently accessed together can be organized for optimal cache utilization.

**Branch prediction** enhances lookup speed. Because column access patterns are often repetitive (the same columns are accessed in the same order repeatedly), CPU branch predictors can effectively optimize the lookup process.

**Small function size** enables inlining. Record view functions are typically small enough to be inlined by the JIT compiler, eliminating function call overhead for frequent accesses.

Benchmarks show that for common table operations, Tacit's approach adds only minimal overhead compared to direct array indexing, while providing far greater readability and safety.

## 3 Numeric Views – Arrays

### 3.1 Arity and Rank

In Tacit, a table is fundamentally an array where one axis (typically the column axis) is indexed by symbols instead of numbers. This creates a data structure that can be accessed using named columns, providing a natural way to work with structured data.

The definition is deliberately straightforward:

```
Table = Array with a Symbolic Axis
```

This simple formula unifies tables with the rest of Tacit's data model. Tables aren't a separate primitive or specialized container—they arise naturally from applying record views to standard arrays.

### 3.2. Array + Record View = Table

Creating a table involves three key steps:

1. **Array allocation**: First, an array with appropriate dimensions is allocated. For a simple table, this is typically a 2D array where the first dimension represents rows and the second dimension represents columns.

2. **Column name table definition**: Next, a column name table is created that maps symbolic names to column indices. This table contains the metadata needed to locate each column by name.

3. **View function attachment**: Finally, a record view function is created and attached to the array as a do-pointer. This function consults the column name table to translate symbols into indices.

The resulting structure can be used with direct column access syntax:

```
table 'population       ( -- population-column )
table 'average-age      ( -- age-column )

'gdp table              ( -- gdp-column )
```

Behind this simple interface, the record view translates symbolic column names to the appropriate array indices.

### 3.3. Schema Definition and Layout

Tables are defined by their schema—the set of column names, their types, and ordering. In Tacit, schemas can be defined either statically at compile time or dynamically at runtime.

**Static Schema Definition** uses a compile-time macro:

```
table: CountryData
  column: population    int-array
  column: average-age   float
  column: gdp           float-array
end-table
```

This generates:
- A schema definition for the table
- A record view function `countrydata-view`
- Helper accessor words (`>population`, `>average-age`, `>gdp`)
- A global column name table shared by all instances

**Dynamic Schema Definition** builds the schema at runtime:

```
{ "population"   : int-array
  "average-age"  : float
  "gdp"          : float-array } make-table-schema
```

This approach is useful when working with external data formats or when schemas need to evolve during program execution.

Within the array, columns are typically organized as vectors along one dimension, with the record view mapping names to the appropriate indices. This organization supports both row-oriented and column-oriented layouts, which we'll explore in section 4.

### 3.4. Access Patterns and Optimization

Table access in Tacit balances simplicity, flexibility, and performance. Several access patterns are supported, each with different performance characteristics:

**Direct column access** is the most common pattern:

```
table 'population            ( -- population-column )      
new-data table 'population !  ( -- )                      # Replace column
```

Each access involves a symbol lookup followed by an array access at the computed index.

**Optimized repeated access** allows caching the index for multiple operations on the same column:

```
table 'population column>index  ( -- population-idx )   # Get index once
dup table array-ref            ( -- population-column ) # Access by index
new-data swap table array-set  ( -- )                   # Update by index  
```

This pattern eliminates repeated symbol lookups, which is beneficial when accessing the same column multiple times.

**Bulk operations** can process multiple columns efficiently:

```
table [ 'population 'gdp 'average-age ] get-columns  ( -- pop gdp age-cols )
table [ new-pop new-gdp new-age ] [ 'population 'gdp 'average-age ] set-columns
```

These operations perform a single traversal of the column name table, amortizing the lookup overhead across multiple columns.

**Compiled access functions** eliminate runtime lookup entirely for known schemas:

```
table >population      ( -- population-column )   # Direct accessor, no lookup
new-data table population!   ( -- )                # Direct setter, no lookup
```

For static schemas, these accessor functions can be compiled to direct array indexing operations, achieving performance equivalent to direct array access.

## 4. Hybrid Access Models

### 4.1. Row-Oriented Tables (Array of Records)

A row-oriented table stores data in row-major order, where each row contains all fields for a single entity. In Tacit's view model, this is implemented as an array of records, with two levels of views:

1. A numeric view function for selecting rows: `row-view ( row# table -- row )`
2. A record view function for selecting columns: `column-view ( column-name row -- value )`

This organization suits cases where most operations process complete records. For example:

```
# Get the population for country at index 5
5 countries-table row-view 'population

# Iterate through all countries
0 countries-table row-count 1 do
  i countries-table row-view
  dup 'name swap 'population
  process-data
loop
```

The row-oriented layout provides excellent insertion and deletion performance and is well-suited to cases where entire records are processed together.

### 4.2. Column-Oriented Tables (Record of Arrays)

A column-oriented table stores data with each column as a contiguous array. This is implemented as a record of arrays:

1. A record view for selecting columns: `column-view ( column-name table -- column-array )`
2. A numeric view for selecting values: `value-view ( index column-array -- value )`

This is ideal for analytical workloads that process a small subset of columns across many rows:

```
# Get the entire population column
countries-table 'population  

# Compute average GDP for all countries
countries-table 'gdp array-sum
countries-table 'gdp array-length /
```

Column-oriented layouts excel at aggregation operations and queries that scan many rows but few columns, such as in analytical processing.

### 4.3. Unified Access Interface

To abstract over these different storage strategies, Tacit provides a unified access interface. A single word `get@` works with both layouts:

```
# Access by both row and column
country-idx 'population countries-table get@

# The implementation detects the table's orientation and composes the appropriate views
```

Behind the scenes, `get@` examines the orientation flag in the table metadata and dispatches to the appropriate view composition:

```
: get@ ( idx|sym ... tbl -- value )
  dup orientation-flag@ row-oriented? if
    swap row-view      # For row-oriented: get row first, then column
    swap column-view
  else
    swap column-view   # For column-oriented: get column first, then index 
    swap idx-view
  then ;
```

This abstraction allows the programmer to work with the most natural model for their domain while the runtime handles the implementation details.

### 4.4. Performance Characteristics

The two layout strategies offer different performance characteristics:

| Operation | Row-Oriented | Column-Oriented |
| --------- | ------------ | -------------- |
| Insert/delete row | O(1) | O(n) where n = # columns |
| Read entire row | O(1) | O(n) where n = # columns |
| Column aggregation | O(n) where n = # rows | O(1) |
| Column projection | O(n) where n = # rows | O(1) |
| Memory locality | High for row operations | High for column operations |

Tacit's hybrid model allows programs to choose the layout that best suits the access patterns of the application, or even to transform between layouts dynamically based on workload characteristics.

## 5. Composing Arrays and Records

### 5.1. Nested Records and Arrays

Tacit's compositional approach naturally extends to nested data structures. A column in a table might itself be a table, or an array of tables:

```
# City-level population data within countries
countries-table 'cities 3     # Get cities table for country at index 3

# Access a specific city's population
countries-table 'cities 3 'population 2  # Population of city 2 in country 3
```

These compositions work because record views can return other arrays or tables, which themselves have views attached. The nesting can continue to arbitrary depth, creating rich hierarchical data structures without additional language mechanisms.

### 5.2. Slicing and Reshaping Tables

Since tables are fundamentally arrays with a symbolic axis, all array operations like slicing and reshaping work on tables as well:

```
# Select rows 10 through 20
countries-table 10:20 slice

# Reshape a 1D array into a table with named columns
data-vector [population gdp unemployment] as-table
```

Slicing preserves the symbolic axis, so the resulting slice is still a table with named columns. Similarly, reshaping can add or remove symbolic axes as needed.

### 5.3. Zero-Copy Transformations

All view operations in Tacit are zero-copy. Converting between different table layouts or transforming their structure involves only changing the view functions, not moving data:

| Operation | Implementation |
| --------- | -------------- |
| Row-store to column-store | `table with-row-view column-store with-column-view` |
| Extract one column | `'column-name table column-view` |
| Create transposed view | `table transpose-view` |
| Filter rows | `predicate table filter-view` |

Each transformation creates a new view that interprets the same underlying data differently, without any copying or allocation.

### 5.4. Combining Symbolic and Numeric Access

Symbolic and numeric access can be freely intermixed and composed:

```
# Get the population column and compute its mean
countries-table 'population array-mean

# Select a subset of columns and compute correlation
countries-table ['gdp 'education 'life-expectancy] select-columns correlate

# Sort rows by a specific column
countries-table 'population by-column sort
```

This hybridization is central to Tacit's approach: by treating symbolic access as just another view function, it can be composed with all other operations in the system.

## 6. Practical Applications

### 6.1. Data Processing Pipelines

Tacit's table model enables expressive data processing pipelines:

```
csv-file parse-csv       # Read CSV into table
  'population as-numeric  # Convert string column to numeric
  'date as-timestamp      # Parse dates 
  'gdp by-column sort     # Sort by GDP
  10 head                 # Take first 10 rows
  [country population gdp] select-columns  # Project needed columns
  process-results         # Final processing
```

Each step in the pipeline transforms the table through view composition, with no intermediate copies.

### 6.2. Schema Evolution and Migration

Dynamic record views enable flexible schema evolution:

```
# Add a new column to an existing table
table 'new-column new-data add-column

# Create a view with columns renamed
table { 'old-name => 'new-name, 'x => 'y } rename-columns

# Project a subset of columns
table ['relevant-col1 'relevant-col2] project
```

This flexibility helps systems adapt to changing requirements without rebuilding data structures or migrating storage.

### 6.3. Real-World Examples

Example applications that demonstrate Tacit's record and table model include:

1. **Time series analysis**: Columns represent different metrics, rows represent time points
2. **Tabular data processing**: CSV/TSV processing, data frame operations
3. **Structured messaging**: Protocol messages with named fields
4. **Configuration systems**: Hierarchical configuration with named parameters
5. **Relational operations**: Joins, filters, and projections on structured data

In each case, the combination of symbolic and numeric access enables concise, efficient code with minimal machinery.

## 7. Performance Notes

### 7.1. Memory Layout and Locality

Tacit's table implementation focuses on optimizing memory access patterns:

- **Row-oriented tables** place all fields for a single entity contiguously, maximizing locality for record-at-a-time processing
- **Column-oriented tables** store each column contiguously, optimizing for analytical operations and efficient use of CPU cache lines
- **Memory alignment** ensures that values are properly aligned for vectorized operations

The zero-copy view model allows the system to choose the optimal layout for each workload without changing the logical data model.

### 7.2. View Function Optimization

Record view functions benefit from several optimization techniques:

- **Symbol interning** enables fast comparison using pointer equality
- **Column name tables** are designed to be small and cache-friendly
- For small tables (≤ 8 columns), **linear search** through the column name table is faster than binary search due to better cache behavior
- **Specialized view functions** for common cases eliminate runtime dispatch
- **Composition caching** prevents redundant view compositions for common access patterns

### 7.3. Cache-Friendly Access Patterns

Tacit's table model encourages cache-friendly operations:

- **Batch processing** of rows or columns maximizes spatial and temporal locality
- **View composition** allows data to stay in cache while being processed through multiple transformations
- **Stride optimization** ensures predictable memory access patterns for better prefetching
- **Vectorization opportunities** arise naturally from the contiguous storage model

These optimizations together ensure that Tacit's symbolic access performs comparably to raw numeric indexing while providing much greater clarity and safety.

## 8. Conclusion

### 8.1. Unified View Model

Tacit's record and table system demonstrates how a small set of orthogonal concepts can combine to create a rich, expressive data model:

- Arrays provide contiguous storage and numeric indexing
- Record views add symbolic indexing along one axis
- Composition of these views enables complex data structures and operations

This unified model achieves a rare combination of simplicity and power. There are no special cases, no separate implementations for different data shapes, and no hidden complexity—just the consistent application of view functions that transform indices to other indices.

### 8.2. Composition as Fundamental Principle

The key insight of Tacit's approach is that composition of simple, regular mechanisms yields greater expressiveness than specialized constructs. By modeling records as view functions that translate symbols to indices—just as array views translate indices to other indices—we gain a system where:

- All operations are composable
- New capabilities emerge from existing primitives
- Code size grows logarithmically with feature set
- Performance optimizations benefit all compositions

This composition-first approach embodies Tacit's design philosophy: memory is raw, interpretation is functional, and power comes from combining simple pieces in regular ways. The result is a data model that handles everything from simple arrays to sophisticated analytical tables with the same minimal machinery, achieving both clarity and performance through compositional design. records, composing both gives tables. Because views
are ordinary words and buffers live naturally on the stack, complex data
structures cost nothing more than the code you already write—no hidden
allocations, no special containers, no new lifetime rules.

Future refinements—stride fusion, static shape checks, schema reflection—will
extend performance and ergonomics, but they will do so inside this single,
predictable framework: **memory is raw, interpretation is functional, and the
programmer is in charge of when the two meet.**

## 9 Conclusion

From raw buffers to multidimensional tensors, from symbol-indexed records to
mixed-axis tables, Tacit relies on _one_ runtime primitive: **attach a view to
a buffer and let that view decide how to map keys to bytes**. Numeric keys give
arrays, symbolic keys give records, composing both gives tables. Because views
are ordinary words and buffers live naturally on the stack, complex data
structures cost nothing more than the code you already write—no hidden
allocations, no special containers, no new lifetime rules.

Future refinements—stride fusion, static shape checks, schema reflection—will
extend performance and ergonomics, but they will do so inside this single,
predictable framework: **memory is raw, interpretation is functional, and the
programmer is in charge of when the two meet.**
