import { Digest } from "../core/digest";
import { PrimitiveTag, toTaggedValue } from "../core/tagged";

export function stringCreate(digest: Digest, value: string): number {
  const address = digest.add(value);
  return toTaggedValue(address, PrimitiveTag.STRING, );
}
