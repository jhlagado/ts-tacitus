/**
 * Debug file to understand print operation's interactions with lists
 */
import { executeTacitCode, resetVM, captureTacitOutput } from '../utils/test-utils';
import { fromTaggedValue, Tag } from '../../core/tagged';
import { vm } from '../../core/globalState';
import { formatValue, formatFloat, formatListAt } from '../../core/format-utils';

describe('Debug print operation', () => {
  beforeEach(() => {
    resetVM();
  });

  test('Debug exact test cases that fail', () => {
    resetVM();
    executeTacitCode('3.14');
    const floatStackData = vm.getStackData();
    const floatValue = floatStackData[0];
    const { tag: floatTag, value: floatRawValue } = fromTaggedValue(floatValue);

    resetVM();
    executeTacitCode('( 1 2 )');
    const listStackData = vm.getStackData();
    listStackData.map(val => {
      const { tag, value } = fromTaggedValue(val);
      return `${val} [${Tag[tag]}:${value}]`;
    });

    const listIndex = listStackData.findIndex(val => {
      const { tag } = fromTaggedValue(val);
      return tag === Tag.LIST;
    });
    if (listIndex >= 0) {
    }

    const linkIndex = listStackData.findIndex(val => {
      const { tag } = fromTaggedValue(val);
      return tag === Tag.LINK;
    });
    if (linkIndex >= 0) {
    }

    resetVM();
    const printOutput = captureTacitOutput('3.14 .');

    resetVM();
    const listPrintOutput = captureTacitOutput('( 1 2 ) .');

    resetVM();
    executeTacitCode('( 1 ( 2 3 ) 4 )');
    const nestedStackData = vm.getStackData();
    nestedStackData.map(val => {
      const { tag, value } = fromTaggedValue(val);
      return `${val} [${Tag[tag]}:${value}]`;
    });
  });

  test('Debug list with LINK pointer case', () => {
    resetVM();

    executeTacitCode('( 10 20 )');

    const stackData = vm.getStackData();

    const linkValue = stackData[stackData.length - 1];
    const { tag, value } = fromTaggedValue(linkValue);

    try {
      resetVM();
      executeTacitCode('( 10 20 )');

    } catch (error) {
    }
  });
});
