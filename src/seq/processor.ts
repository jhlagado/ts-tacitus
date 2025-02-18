// File: src/seq/processor.ts

import { Heap } from "../data/heap";
import { seqDup } from "./sequence";
import {
  UNDEF,
  Tag,
  toTaggedValue,
  fromTaggedValue,
  isUnDef,
} from "../tagged-value";
import { TRUE } from "../constants";

// Unified Sequence Block Layout offsets (each field is 2 bytes)
export const SEQ_PARENT_VIEW = 4; // Pointer to source sequence block
export const SEQ_MAJOR_POS = 6; // Current index along parent's dimension 0
export const SEQ_TOTAL = 8; // Total number of slices
export const SEQ_SLICE_VIEW = 10; // Pointer to reusable slice view
export const SEQ_RANK = 12; // Parent's rank

// Extended processor fields:
export const PROC_FLAG = 14; // Processor flag (nonzero means processor sequence)
export const PROC_TYPE = 16; // Processor opcode
export const PROC_PARAM = 18; // Processor parameter
export const PROC_STATE = 20; // Processor state

export enum ProcessorType {
  MAP = 1,
  FILTER = 2,
  SCAN = 3,
  TAKE = 4,
  DROP = 5,
  SLICE = 6,
  FLATMAP = 7,
}

/**
 * buildProcessor is a generic helper that creates a processor sequence block.
 * It duplicates the source sequence, copies its metadata, and writes processor-specific fields.
 *
 * @param heap - The heap instance.
 * @param srcSeq - A tagged sequence pointer to the source sequence.
 * @param procType - The processor opcode.
 * @param procParam - The processor parameter.
 * @param procState - The initial processor state (default 0).
 * @param majorPos - Starting major position (default 0).
 * @param overrideTotal - If provided, overrides the total slices.
 * @returns A tagged sequence pointer representing the processor sequence, or UNDEF on failure.
 */
function buildProcessor(
  heap: Heap,
  srcSeq: number,
  procType: ProcessorType,
  procParam: number,
  procState: number = 0,
  majorPos: number = 0,
  overrideTotal?: number
): number {
  const srcDup = seqDup(heap, srcSeq);
  if (isUnDef(srcDup)) return UNDEF;
  const srcSeqBlock = fromTaggedValue(Tag.SEQ, srcDup).value;
  const origTotal = heap.memory.read16(srcSeqBlock + SEQ_TOTAL);
  const total = overrideTotal !== undefined ? overrideTotal : origTotal;
  const procBlock = heap.malloc(64);
  if (isUnDef(procBlock)) return UNDEF;
  const rank = heap.memory.read16(srcSeqBlock + SEQ_RANK);
  heap.memory.write16(procBlock + SEQ_PARENT_VIEW, srcSeqBlock);
  heap.memory.write16(procBlock + SEQ_MAJOR_POS, majorPos);
  heap.memory.write16(procBlock + SEQ_TOTAL, total);
  heap.memory.write16(procBlock + SEQ_RANK, rank);
  heap.memory.write16(procBlock + PROC_FLAG, TRUE);
  heap.memory.write16(procBlock + PROC_TYPE, procType);
  heap.memory.write16(procBlock + PROC_PARAM, procParam);
  heap.memory.write16(procBlock + PROC_STATE, procState);
  return toTaggedValue(Tag.SEQ, procBlock);
}

/**
 * procMap creates a processor sequence that multiplies each element by a multiplier.
 *
 * @param heap - The heap instance.
 * @param srcSeq - A tagged sequence pointer to the source sequence.
 * @param multiplier - The multiplier value.
 * @returns A tagged sequence pointer for the mapped sequence, or UNDEF on failure.
 */
export function procMap(
  heap: Heap,
  srcSeq: number,
  multiplier: number
): number {
  return buildProcessor(heap, srcSeq, ProcessorType.MAP, multiplier);
}

/**
 * procFilter creates a processor sequence that filters elements.
 * Only elements greater than or equal to the threshold pass through.
 *
 * @param heap - The heap instance.
 * @param srcSeq - A tagged sequence pointer to the source sequence.
 * @param threshold - The threshold value.
 * @returns A tagged sequence pointer for the filtered sequence, or UNDEF on failure.
 */
export function procFilter(
  heap: Heap,
  srcSeq: number,
  threshold: number
): number {
  return buildProcessor(heap, srcSeq, ProcessorType.FILTER, threshold);
}

/**
 * procScan creates a processor sequence that performs a cumulative scan.
 *
 * @param heap - The heap instance.
 * @param srcSeq - A tagged sequence pointer to the source sequence.
 * @param initial - The initial accumulator value.
 * @returns A tagged sequence pointer for the scanned sequence, or UNDEF on failure.
 */
export function procScan(heap: Heap, srcSeq: number, initial: number): number {
  return buildProcessor(heap, srcSeq, ProcessorType.SCAN, 0, initial);
}

/**
 * procTake creates a processor sequence that yields only the first n elements.
 *
 * @param heap - The heap instance.
 * @param srcSeq - A tagged sequence pointer to the source sequence.
 * @param n - The number of elements to take.
 * @returns A tagged sequence pointer for the taken sequence, or UNDEF on failure.
 */
export function procTake(heap: Heap, srcSeq: number, n: number): number {
  return buildProcessor(heap, srcSeq, ProcessorType.TAKE, n, 0, 0, n);
}

/**
 * procDrop creates a processor sequence that skips the first n elements.
 *
 * @param heap - The heap instance.
 * @param srcSeq - A tagged sequence pointer to the source sequence.
 * @param n - The number of elements to drop.
 * @returns A tagged sequence pointer for the dropped sequence, or UNDEF on failure.
 */
export function procDrop(heap: Heap, srcSeq: number, n: number): number {
  return buildProcessor(heap, srcSeq, ProcessorType.DROP, n, 0, 0);
}

/**
 * procSlice creates a processor sequence that returns a slice starting at the given index for a given count.
 *
 * @param heap - The heap instance.
 * @param srcSeq - A tagged sequence pointer to the source sequence.
 * @param start - The starting index.
 * @param count - The number of elements to take.
 * @returns A tagged sequence pointer for the slice, or UNDEF on failure.
 */
export function procSlice(
  heap: Heap,
  srcSeq: number,
  start: number,
  count: number
): number {
  // Note: For slice, we want to drop the first 'start' elements.
  return buildProcessor(
    heap,
    srcSeq,
    ProcessorType.SLICE,
    start,
    count,
    0,
    count
  );
}

/**
 * procFlatMap creates a processor sequence that applies a flat-mapping transformation.
 * (Note: The mapper function is applied externally.)
 *
 * @param heap - The heap instance.
 * @param srcSeq - A tagged sequence pointer to the source sequence.
 * @returns A tagged sequence pointer for the flat-mapped sequence, or UNDEF on failure.
 */
export function procFlatMap(heap: Heap, srcSeq: number): number {
  return buildProcessor(heap, srcSeq, ProcessorType.FLATMAP, 0);
}
