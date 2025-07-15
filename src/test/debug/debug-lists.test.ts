/**
 * Debug file to understand list structure on the stack
 */
import { executeTacitCode, resetVM } from '../utils/test-utils';
import { fromTaggedValue, Tag } from '../../core/tagged';
import { vm } from '../../core/globalState';

describe('Debug list structure', () => {
  beforeEach(() => {
    resetVM();
  });

  test('Debug basic list structure', () => {
    executeTacitCode('( 1 2 )');
    const stackData = vm.getStackData();

    for (let i = 0; i < stackData.length; i++) {
      const item = stackData[i];
      const { tag, value } = fromTaggedValue(item);
    }
  });

  test('Debug nested list structure', () => {
    executeTacitCode('( 1 ( 2 3 ) 4 )');
    const stackData = vm.getStackData();

    for (let i = 0; i < stackData.length; i++) {
      const item = stackData[i];
      const { tag, value } = fromTaggedValue(item);
    }
  });

  test('Debug float value', () => {
    executeTacitCode('3.14');
    const stackData = vm.getStackData();

    for (let i = 0; i < stackData.length; i++) {
      const item = stackData[i];
      const { tag, value } = fromTaggedValue(item);
    }
  });
});
