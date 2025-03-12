import { Digest } from "../core/digest";
import { CoreTag, toTaggedValue } from "../core/tagged-value";

export function stringCreate(digest: Digest, value: string): number {
  const address = digest.add(value);
  return toTaggedValue(address, false, CoreTag.STRING, );
}
