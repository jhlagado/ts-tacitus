/**
 * Debug file to understand list structure on the stack
 */
import { executeTacitCode, resetVM } from '../testUtils';
import { fromTaggedValue, Tag } from '../../core/tagged';
import { vm } from '../../core/globalState';

describe('Debug list structure', () => {
  beforeEach(() => {
    resetVM();
  });

  test('Debug basic list structure', () => {
    executeTacitCode('( 1 2 )');
    const stackData = vm.getStackData();

    console.log('STACK AFTER ( 1 2 )');
    for (let i = 0; i < stackData.length; i++) {
      const item = stackData[i];
      const { tag, value } = fromTaggedValue(item);
      console.log(`[${i}]: ${item} (Tag: ${Tag[tag]}, Value: ${value})`);
    }
  });

  test('Debug nested list structure', () => {
    executeTacitCode('( 1 ( 2 3 ) 4 )');
    const stackData = vm.getStackData();

    console.log('STACK AFTER ( 1 ( 2 3 ) 4 )');
    for (let i = 0; i < stackData.length; i++) {
      const item = stackData[i];
      const { tag, value } = fromTaggedValue(item);
      console.log(`[${i}]: ${item} (Tag: ${Tag[tag]}, Value: ${value})`);
    }
  });

  test('Debug float value', () => {
    executeTacitCode('3.14');
    const stackData = vm.getStackData();

    console.log('STACK AFTER 3.14');
    for (let i = 0; i < stackData.length; i++) {
      const item = stackData[i];
      const { tag, value } = fromTaggedValue(item);
      console.log(`[${i}]: ${item} (Tag: ${Tag[tag]}, Value: ${value})`);
    }
  });
});
