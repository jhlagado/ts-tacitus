**Sequences** are a unifying abstraction in this language for reading items from a data source (like a vector or range) and applying transformations (processors) in a pipeline. They are implemented by storing both source and processor logic in a standard **64-byte block** called a “sequence block.” Here is an overview:

1. **Sequence Block Layout**  
   Each sequence occupies one 64 byte block that contains:
   - **Parent pointer**: A reference to the underlying data (e.g., a vector or another sequence).  
   - **Major position**: The current index (or slice number) in the iteration.  
   - **Total**: How many slices/elements remain.  
   - **Slice view**: A pointer to a child view or sub‐sequence (used if the sequence returns sub-arrays).  
   - **Rank**: Dimensionality for multi-dimensional data (e.g., if each item is a 2D slice).  
   - **Processor fields**: A flag indicating whether transformations must be applied, plus an opcode (e.g., MAP, FILTER, SCAN) and any parameters/state needed for that transformation.

2. **Iteration (seqNext)**  
   - The function `seqNext` is responsible for fetching the next item from the sequence.  
   - It checks if there are items left (`major position < total`); if not, it returns **UNDEF**.  
   - If this block is a simple data source, it directly reads from the parent vector or range. If it’s a **processor**, then `seqNext` calls `processorNext`, which fetches from the underlying sequence and applies a transform.

3. **Processors**  
   - When the sequence block has a processor flag set, each call to `seqNext` is delegated to `processorNext`.  
   - Common operations include:
     - **MAP**: Apply a function like multiply by a scalar.  
     - **FILTER**: Skip items that don’t meet a condition (e.g., below a threshold).  
     - **SCAN**: Compute a running accumulation (sum, product, etc.).  
     - **DROP**, **SLICE**, **TAKE**: Skip or limit items.  
     - **FLATMAP**: Iterate over sub-sequences, merging them.  
   - These processors return a **standard sequence block**, so pipelines (map → filter → scan → etc.) form naturally.

4. **Reference Counting & Copy-on-Write**  
   - Under the hood, each 64 byte block is reference-counted. Cloning only happens if a block is shared and must be mutated, ensuring memory efficiency.  
   - Sequences share this mechanism with other data structures like vectors and views.

5. **Chaining & Uniform Interface**  
   - Because both plain data sources and transformations appear as sequences, a uniform `seqNext` function handles them all.  
   - At the end, a **sink** (like `seqReduce` or `seqRealize`) repeatedly calls `seqNext` until it gets an **UNDEF**, consuming the pipeline.

Overall, **sequences** provide a flexible, point-free mechanism for generating, transforming, and consuming data in a compact 64 byte block format, with straightforward iteration through `seqNext`.