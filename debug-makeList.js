const { executeProgram } = require('./dist/lang/interpreter');
const { vm } = require('./dist/core/globalState');
const { resetVM } = require('./dist/test/utils/vm-test-utils');
const { isList, fromTaggedValue, getTag } = require('./dist/core/tagged');

console.log("=== Testing makeList operation ===");

resetVM();
console.log("Initial stack:", vm.getStackData());

try {
  executeProgram('{ 42 } makeList');
  console.log("After { 42 } makeList:");
  console.log("Stack length:", vm.getStackData().length);
  console.log("Stack data:", vm.getStackData());
  
  if (vm.getStackData().length > 0) {
    const tos = vm.peek();
    console.log("TOS value:", tos);
    console.log("TOS hex:", tos.toString(16));
    console.log("TOS tag:", getTag(tos));
    console.log("Is LIST:", isList(tos));
    console.log("Decoded TOS:", fromTaggedValue(tos));
  }
} catch (error) {
  console.error("Error:", error.message);
}