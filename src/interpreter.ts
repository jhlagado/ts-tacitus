import {
  abortOp,
  branchCallOp,
  branchOp,
  callOp,
  divideOp,
  dropOp,
  dupOp,
  evalOp,
  exitOp,
  literalNumberOp,
  minusOp,
  multiplyOp,
  Op,
  plusOp,
  swapOp,
} from "./builtins";
import { vm } from "./globalState";

export function execute(start: number): void {
  vm.IP = start;
  while (vm.running) {
    const opcode = vm.next8(); // Read the 8-bit opcode
    if (vm.debug) console.log({ opcode }, vm.IP - 1);
    try {
      switch (opcode) {
        case Op.LiteralNumber:
          literalNumberOp(vm);
          break;
        case Op.Branch:
          branchOp(vm);
          break;
        case Op.BranchCall:
          branchCallOp(vm);
          break;
        case Op.Call:
          callOp(vm);
          break;
        case Op.Abort:
          abortOp(vm);
          break;
        case Op.Exit:
          exitOp(vm);
          break;
        case Op.Eval:
          evalOp(vm);
          break;
        case Op.Plus:
          plusOp(vm);
          break;
        case Op.Minus:
          minusOp(vm);
          break;
        case Op.Multiply:
          multiplyOp(vm);
          break;
        case Op.Divide:
          divideOp(vm);
          break;
        case Op.Dup:
          dupOp(vm);
          break;
        case Op.Drop:
          dropOp(vm);
          break;
        case Op.Swap:
          swapOp(vm);
          break;
        default:
          throw new Error(
            `Invalid opcode: ${opcode} (stack: ${JSON.stringify(
              vm.getStackData()
            )})`
          );
      }
    } catch (error) {
      const stackState = JSON.stringify(vm.getStackData());
      const errorMessage =
        `Error executing word (stack: ${stackState})` +
        (error instanceof Error ? `: ${error.message}` : "");
      if (vm.debug) console.log((error as Error).stack);
      throw new Error(errorMessage);
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
