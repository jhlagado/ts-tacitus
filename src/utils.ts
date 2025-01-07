import { Verb } from "./types";

export function isVerb(value: unknown): value is Verb {
  return typeof value === "function";
}
