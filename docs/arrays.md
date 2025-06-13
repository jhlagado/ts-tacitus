## 1. Introduction

Arrays in Tacit are defined as structured views over raw memory buffers. These views provide a functional interpretation of the buffer’s contents, translating index-based input into memory offsets. Arrays are first-class values in Tacit and are typically composed of a flat buffer paired with a view function that maps multidimensional or logical indices to concrete byte offsets. This decoupling of storage and access semantics allows arrays to remain lightweight and composable.

Arrays are always based on buffers, but not all buffers are arrays. A buffer becomes an array only when interpreted through a view. The view carries shape information, access logic, and optional metadata that defines the array’s dimensional structure. Arrays are used for mathematical data, signal streams, tabular processing, and other domains where indexed data access is required.

This document defines arrays formally within Tacit’s execution model, distinguishes them from other structures such as records and spans, and describes how views, shapes, and prototypes contribute to their behavior. The goal is to provide a minimal but powerful foundation for multidimensional and irregular data access without introducing high-overhead abstraction layers.
