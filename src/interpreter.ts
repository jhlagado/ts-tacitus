import { vm } from "./globalState";
import { immediateWords } from "./builtins";
import { isVerb } from "./utils";

export function execute(): void {
  vm.resetBuffer();
  vm.IP.ofs = vm.buffer.base;
  while (vm.running) {
    const cell = vm.next();
    if (typeof cell === "number") {
      throw new Error("Unexpected number in buffer");
    }
    if (isVerb(cell)) {
      if (vm.compiler.compileMode && !immediateWords.includes(cell)) {
        vm.compiler.compile(cell); // Use vm.compiler.compile for compileBuffer
      } else {
        try {
          cell(vm); // Pass vm to the verb
        } catch (error) {
          const stackState = JSON.stringify(vm.getStackItems());
          const errorMessage =
            `Unknown error executing word (stack: ${stackState})` +
            (error instanceof Error ? `:${error.message}` : "");
          throw new Error(errorMessage);
        }
      }
    } else if (typeof cell === "number") {
      throw new Error(`Unexpected number: ${cell}`);
    } else {
      throw new Error(`Unexpected object: ${JSON.stringify(cell)}`);
    }
  }
}