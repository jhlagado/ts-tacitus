// Script to debug list operations in isolated environment
const { vm, initializeInterpreter } = require('./dist/core/globalState');
const { fromTaggedValue, Tag, toTaggedValue } = require('./dist/core/tagged');
const { parse } = require('./dist/lang/parser');
const { Tokenizer } = require('./dist/lang/tokenizer');
const { execute } = require('./dist/lang/interpreter');

// Reset and initialize VM
initializeInterpreter();
vm.SP = 0;
vm.RP = 0;
vm.IP = 0;
vm.listDepth = 0;
vm.compiler.reset();
vm.compiler.BCP = 0;
vm.compiler.CP = 0;

// Execute simple list creation code
const code = '( 1 2 )';
parse(new Tokenizer(code));
execute(vm.compiler.BCP);

// Inspect stack
const stack = vm.getStackData();
console.log('Stack length:', stack.length);
console.log('Stack items:');
for (let i = 0; i < stack.length; i++) {
  const item = stack[i];
  const { tag, value } = fromTaggedValue(item);
  console.log(`[${i}] Value: ${value}, Tag: ${Tag[tag]} (${tag})`);
}

// Check if list tag works correctly in isolated context
console.log('\nTesting direct tag creation:');
const testListTag = toTaggedValue(2, Tag.LIST);
const { tag: testTag, value: testValue } = fromTaggedValue(testListTag);
console.log(`Created list tag: ${testValue}, Tag: ${Tag[testTag]} (${testTag})`);
