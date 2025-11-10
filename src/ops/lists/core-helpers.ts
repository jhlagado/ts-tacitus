/**
 * @file src/ops/lists/core-helpers.ts
 * Shared helpers for list operations (absolute-first APIs).
 */

import { getListBounds, computeHeaderCell } from '@src/core';

/**
 * Extract list header and base cell from a direct LIST or a reference.
 * Returns null if value is neither a list nor a ref-to-list.
 */
export { getListBounds };

/**
 * Computes header cell index given base cell index and slot count.
 */
export { computeHeaderCell };
