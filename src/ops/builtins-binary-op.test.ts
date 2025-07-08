import { VM } from '../core/vm';
import { initializeInterpreter, vm } from '../core/globalState';

describe('Built-in Binary Op Operations', () => {
  let testVM: VM;
  beforeEach(() => {
    initializeInterpreter();
    testVM = vm;
    testVM.debug = false;
  });

  it('should have at least one test', () => {
    expect(true).toBe(true);
  });
});
