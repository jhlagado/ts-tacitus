/**
 * @file builtins-print.ts
 * Implementation of the print operation for the Tacit VM
 */
import { VM } from '../core/vm';
import { fromTaggedValue, Tag } from '../core/tagged';
import { formatAtomicValue } from '../core/format-utils';
import { BYTES_PER_ELEMENT } from '../core/constants';

/**
 * Print operation - prints the top value on the stack
 */
export function printOp(vm: VM): void {
  try {
    if (vm.SP < BYTES_PER_ELEMENT) {
      console.log('[Error: Stack empty]');
      return;
    }

    const topValue = vm.peek();
    const { tag, value: tagValue } = fromTaggedValue(topValue);

    let formatted: string;

    if (tag === Tag.LINK) {
      if (tagValue > 0 && vm.SP >= tagValue * BYTES_PER_ELEMENT) {
        const stackData = vm.getStackData();
        const currentIndex = stackData.length - 1;
        const listIndex = currentIndex - tagValue;

        if (listIndex >= 0) {
          const listTagValue = stackData[listIndex];
          const { tag: listTag, value: listSize } = fromTaggedValue(listTagValue);

          if (listTag === Tag.LIST || (Number.isNaN(listTagValue) && listSize >= 0)) {
            const items = [];
            for (let i = 0; i < listSize; i++) {
              if (listIndex + i + 1 < stackData.length) {
                const elemValue = stackData[listIndex + i + 1];
                const elemFormatted = formatAtomicValue(vm, elemValue);
                items.push(elemFormatted);
              }
            }
            formatted = `( ${items.join(' ')} )`;
          } else {
            formatted = '( invalid list )';
          }
        } else {
          formatted = '( invalid link )';
        }
      } else {
        formatted = '( link )';
      }

      vm.pop();
    } else if (tag === Tag.LIST || (Number.isNaN(topValue) && tagValue >= 0)) {
      const size = Number.isNaN(topValue) ? tagValue : Number(tagValue);
      const stackData = vm.getStackData();
      const items = [];

      for (let i = 0; i < size; i++) {
        if (stackData.length > i + 1) {
          const elemValue = stackData[stackData.length - size + i];

          const { tag: elemTag } = fromTaggedValue(elemValue);
          if (elemTag !== Tag.LINK) {
            items.push(formatAtomicValue(vm, elemValue));
          }
        }
      }

      formatted = `( ${items.join(' ')} )`;

      vm.pop();

      for (let i = 0; i < size && vm.SP >= BYTES_PER_ELEMENT; i++) {
        vm.pop();
      }

      if (vm.SP >= BYTES_PER_ELEMENT) {
        const possibleLink = vm.peek();
        const { tag: nextTag } = fromTaggedValue(possibleLink);
        if (nextTag === Tag.LINK) {
          vm.pop();
        }
      }
    } else {
      formatted = formatAtomicValue(vm, topValue);
      vm.pop();
    }

    console.log(formatted);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`[Print error: ${errorMessage}]`);

    if (vm.SP >= BYTES_PER_ELEMENT) {
      try {
        vm.pop();
      } catch (_) {
        /* Ignore */
      }
    }
  }
}
