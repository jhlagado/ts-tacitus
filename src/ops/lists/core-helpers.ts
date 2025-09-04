/**
 * @file src/ops/lists/core-helpers.ts
 * Shared, segment-aware helpers for list operations.
 */

import { VM, getListHeaderAndBase, computeHeaderAddr } from '@src/core';

/**
 * Extract list header and base address from a direct LIST or a reference.
 * Returns null if value is neither a list nor a ref-to-list.
 */
export { getListHeaderAndBase };

/**
 * Computes header address given base address and slot count.
 */
export { computeHeaderAddr };
