import { fromTaggedValue, Tag, tagNames } from './tagged';

/**
 * Recursively prints any Tacit value with indentation, hex addresses, tags, and contents.
 */

export function prn(title: string, tval: number): void {
  console.warn(`${title ?? ''}: ${formatValue(tval, 0)}`);
}

function formatValue(tval: number, indent = 0): string {
  const { value: _value, tag } = fromTaggedValue(tval);
  const name = toTagName(tag);
  const prefix = `${'  '.repeat(indent)}${name}: `;
  return `${prefix}${scalarRepr(tval)}`;
}

function toTagName(tag: number): string {
  return tagNames[tag as Tag] || `UnknownTag(${tag})`;
}

function scalarRepr(tval: number): string {
  const { tag, value } = fromTaggedValue(tval);
  switch (tag) {
    case Tag.INTEGER:
      return `${value}`;
    case Tag.CODE:
      return `<code>`;
    case Tag.STRING:
      return `"[string:${value}]"`;
    default:
      return `${tval}`;
  }
}
