import { verbs } from "./builtins";
import { vm } from "./globalState";

export function execute(start: number): void {
  vm.IP = start;
  while (vm.running) {
    const opcode = vm.next8(); // Read the 8-bit opcode
    console.log({ opcode }, vm.IP-1);
    if (vm.compiler.compileMode) {
      vm.compiler.compile8(opcode);
    } else {
      const verb = verbs[opcode];
      if (verb === undefined) {
        throw new Error(
          `Invalid opcode: ${opcode} (stack: ${JSON.stringify(
            vm.getStackData()
          )})`
        );
      }
      try {
        verb(vm);
      } catch (error) {
        const stackState = JSON.stringify(vm.getStackData());
        const errorMessage =
          `Error executing word (stack: ${stackState})` +
          (error instanceof Error ? `: ${error.message}` : "");
        if (vm.debug) console.log((error as Error).stack);
        throw new Error(errorMessage);
      }
    }
  }

  // After execution, manage memory based on preserve flag
  if (vm.compiler.preserve) {
    // Preserve the compiled code: move BP to CP
    vm.compiler.BP = vm.compiler.CP;
  } else {
    // Reuse memory: reset CP to BP
    vm.compiler.reset();
  }
  vm.compiler.preserve = false; // Reset preserve flag
}
