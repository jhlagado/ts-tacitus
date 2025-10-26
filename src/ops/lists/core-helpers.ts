/**
 * @file src/ops/lists/core-helpers.ts
 * Shared helpers for list operations (absolute-first APIs).
 */

import { getListBounds, computeHeaderAddr } from '@src/core';

/**
 * Extract list header and absolute base address from a direct LIST or a reference.
 * Returns null if value is neither a list nor a ref-to-list.
 */
export { getListBounds };

/**
 * Computes absolute header address given absolute base address and slot count.
 */
export { computeHeaderAddr };
