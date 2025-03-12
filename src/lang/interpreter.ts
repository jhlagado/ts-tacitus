import { executeOp } from "./ops/builtins";
import { vm } from "../core/globalState";

export function execute(start: number): void {
  // vm.debug = true;
  vm.IP = start;
  vm.running = true;
  while (vm.running) {
    const opcode = vm.next8(); // Read the 8-bit opcode
    if (vm.debug) console.log({ opcode }, vm.IP - 1);
    try {
      executeOp(vm, opcode);
    } catch (error) {
      const stackState = JSON.stringify(vm.getStackData());
      const errorMessage =
        `Error executing word (stack: ${stackState})` +
        (error instanceof Error ? `: ${error.message}` : "");
      if (vm.debug) console.log((error as Error).stack);
      throw new Error(errorMessage);
    }
  }
  vm.compiler.reset();
  vm.compiler.preserve = false; // Reset preserve flag
}
