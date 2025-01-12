import { vm } from "./globalState";
import { immediateWords } from "./builtins";
import { isVerb } from "./utils";

export function execute(): void {
  vm.resetBuffer();
  vm.IP.ofs = vm.buffer.base;
  while (vm.running) {
    const cell = vm.next();
    console.log(cell);
    if (typeof cell === "number") {
      throw new Error("Unexpected number in buffer");
    }
    if (isVerb(cell)) {
      if (vm.compiler.compileMode && !immediateWords.includes(cell)) {
        console.log("compiling");
        vm.compiler.compile(vm.compiler.compileBuffer, cell);
      } else {
        try {
          console.log("executing");
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
