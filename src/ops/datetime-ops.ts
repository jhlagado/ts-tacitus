import { VM } from "../vm";
import { Verb } from "../types";

/**
 * Returns current timestamp
 * No args: Returns timestamp.
 * Other: Error.
 */
export const nowOp: Verb = (vm: VM) => {
  if (vm.debug) console.log("nowOp");
  // Implementation here
};

/**
 * Extracts date from timestamp
 * Timestamp: Returns date part.
 * String: Parses date.
 * Other: Error.
 */
export const dateOp: Verb = (vm: VM) => {
  const a = vm.pop();
  if (vm.debug) console.log("dateOp", a);
  // Implementation here
};

/**
 * Extracts time from timestamp
 * Timestamp: Returns time part.
 * String: Parses time.
 * Other: Error.
 */
export const timeOp: Verb = (vm: VM) => {
  const a = vm.pop();
  if (vm.debug) console.log("timeOp", a);
  // Implementation here
};

/**
 * Creates timestamp from date/time
 * Date/Time: Combines.
 * String: Parses timestamp.
 * Other: Error.
 */
export const timestampOp: Verb = (vm: VM) => {
  const time = vm.pop();
  const date = vm.pop();
  if (vm.debug) console.log("timestampOp", date, time);
  // Implementation here
};

/**
 * Computes difference between dates/times
 * Two timestamps: Returns time delta.
 * Two dates: Returns day count.
 * Other: Error.
 */
export const diffOp: Verb = (vm: VM) => {
  const b = vm.pop();
  const a = vm.pop();
  if (vm.debug) console.log("diffOp", a, b);
  // Implementation here
};
