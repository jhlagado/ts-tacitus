/**
 * Debug file to understand print operation's interactions with lists
 */
import { executeTacitCode, resetVM, captureTacitOutput } from '../testUtils';
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
    console.log('\nDEBUG FLOAT 3.14:');
    const floatStackData = vm.getStackData();
    console.log('Stack with 3.14:', floatStackData);
    const floatValue = floatStackData[0];
    const { tag: floatTag, value: floatRawValue } = fromTaggedValue(floatValue);
    console.log(`Float tagged value: ${floatValue}, Tag: ${Tag[floatTag]}, Raw: ${floatRawValue}`);
    console.log('formatFloat output:', formatFloat(floatRawValue));
    console.log('formatValue output:', formatValue(vm, floatValue));

    resetVM();
    executeTacitCode('( 1 2 )');
    console.log('\nDEBUG SIMPLE LIST:');
    const listStackData = vm.getStackData();
    console.log(
      'Stack with list ( 1 2 ):',
      listStackData.map(val => {
        const { tag, value } = fromTaggedValue(val);
        return `${val} [${Tag[tag]}:${value}]`;
      }),
    );

    const listIndex = listStackData.findIndex(val => {
      const { tag } = fromTaggedValue(val);
      return tag === Tag.LIST;
    });
    if (listIndex >= 0) {
      console.log('formatListAt output:', formatListAt(vm, listStackData, listIndex));
    }

    const linkIndex = listStackData.findIndex(val => {
      const { tag } = fromTaggedValue(val);
      return tag === Tag.LINK;
    });
    if (linkIndex >= 0) {
      console.log('formatValue on LINK:', formatValue(vm, listStackData[linkIndex]));
    }

    resetVM();
    const printOutput = captureTacitOutput('3.14 .');
    console.log('\nPrint operation output for 3.14:', printOutput);

    resetVM();
    const listPrintOutput = captureTacitOutput('( 1 2 ) .');
    console.log('Print operation output for ( 1 2 ):', listPrintOutput);

    resetVM();
    executeTacitCode('( 1 ( 2 3 ) 4 )');
    console.log('\nDEBUG NESTED LIST:');
    const nestedStackData = vm.getStackData();
    console.log(
      'Stack with nested list:',
      nestedStackData.map(val => {
        const { tag, value } = fromTaggedValue(val);
        return `${val} [${Tag[tag]}:${value}]`;
      }),
    );
  });

  test('Debug list with LINK pointer case', () => {
    resetVM();

    executeTacitCode('( 10 20 )');

    const stackData = vm.getStackData();
    console.log('\nDEBUG LINK REFERENCE:');
    console.log(
      'Stack with list on it:',
      stackData.map(val => {
        const { tag, value } = fromTaggedValue(val);
        return `${val} [${Tag[tag]}:${value}]`;
      }),
    );

    const linkValue = stackData[stackData.length - 1];
    const { tag, value } = fromTaggedValue(linkValue);
    console.log(`Top value: ${linkValue} [${Tag[tag]}:${value}]`);
    console.log('formatValue output:', formatValue(vm, linkValue));

    try {
      resetVM();
      executeTacitCode('( 10 20 )');

      console.log('Running print operation manually to check for errors...');
    } catch (error) {
      console.error('Error during print:', error);
    }
  });
});
