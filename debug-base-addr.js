// Quick debug script to understand base address calculation
const { executeTacitCode, resetVM } = require('./src/test/utils/vm-test-utils.ts');
const { vm } = require('./src/core/globalState.ts');

try {
  resetVM();
  console.log('=== Debug base address calculation ===');
  
  // Create a simple list
  const result = executeTacitCode('( 1 2 3 )');
  console.log('After ( 1 2 3 ):', result);
  console.log('Stack contents:', vm.getStackData());
  const CELL_SIZE = 4;
  const spCells = vm.SP;
  const spBytes = spCells * CELL_SIZE;
  console.log('SP(cells):', spCells, 'SP(bytes):', spBytes);
  
  // List header should be at SP - 4
  const headerAddr = spBytes - CELL_SIZE;
  console.log('Header should be at addr:', headerAddr);
  const header = vm.memory.readFloat32(0, headerAddr);
  console.log('Header value:', header);
  
  // Calculate base address
  const slotCount = 3; // We know this is 3 for ( 1 2 3 )
  const baseAddr1 = spBytes - CELL_SIZE - slotCount * CELL_SIZE; // My calculation
  const baseAddr2 = spBytes - (slotCount + 1) * CELL_SIZE; // Alternative 
  
  console.log('Base addr method 1 (SP - 4 - slots*4):', baseAddr1);
  console.log('Base addr method 2 (SP - (slots+1)*4):', baseAddr2);
  
  console.log('=== End debug ===');
} catch (error) {
  console.error('Error:', error.message);
}
