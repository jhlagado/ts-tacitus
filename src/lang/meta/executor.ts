import { SyntaxError, Tag, fromTaggedValue, RSTACK_BASE, STACK_BASE } from '@src/core';
import { SEG_CODE } from '@src/core/constants';
import type { Op } from '../../ops/opcodes';
import { executeOp } from '../../ops/builtins';
import { evalOp } from '../../ops/core';
import { type VM, nextOpcode, rdepth, getStackData, rpush } from '../../core/vm';
import { decodeX1516 } from '../../core/code-ref';
import type { Tokenizer } from '../tokenizer';
import type { ActiveDefinition } from '../state';
// SymbolTableEntry interface moved inline (symbol table removed)
type SymbolTableEntry = {
  taggedValue: number;
  isImmediate: boolean;
};
import {
  beginDefinitionImmediate,
  beginIfImmediate,
  beginElseImmediate,
  beginMatchImmediate,
  beginWithImmediate,
  beginCaseImmediate,
  clauseDoImmediate,
  defaultImmediate,
  nilImmediate,
  beginCapsuleImmediate,
} from './index';

/**
 * Executes an immediate word during parsing.
 * Immediate words execute at compile time rather than runtime.
 * @param vm - VM instance
 * @param name - Name of the immediate word
 * @param entry - Symbol table entry for the word
 * @param tokenizer - Tokenizer instance
 * @param currentDefinition - Current definition context
 */
export function executeImmediateWord(
  vm: VM,
  name: string,
  entry: SymbolTableEntry,
  tokenizer: Tokenizer,
  currentDefinition: { current: ActiveDefinition | null },
): void {
  const { tag, value } = fromTaggedValue(entry.taggedValue);

  if (tag === Tag.BUILTIN) {
    // Dispatch known meta-immediate words by name (compile-time actions)
    switch (name) {
      case ':':
        beginDefinitionImmediate(vm, tokenizer, currentDefinition);
        return;
      case 'if':
        beginIfImmediate(vm, tokenizer, currentDefinition);
        return;
      case ';':
        if (vm.sp - STACK_BASE === 0) {
          throw new SyntaxError('Unexpected semicolon', getStackData(vm));
        }
        evalOp(vm);
        return;
      case 'else':
        beginElseImmediate(vm, tokenizer, currentDefinition);
        return;
      case 'match':
        beginMatchImmediate(vm, tokenizer, currentDefinition);
        return;
      case 'with':
        beginWithImmediate(vm, tokenizer, currentDefinition);
        return;
      case 'case':
        beginCaseImmediate(vm, tokenizer, currentDefinition);
        return;
      case 'do':
        // 'do' is used for case clauses (dispatch/mapping)
        // clauseDoImmediate validates that we're in a case context
        clauseDoImmediate(vm, tokenizer, currentDefinition);
        return;
      case 'DEFAULT':
        defaultImmediate(vm, tokenizer, currentDefinition);
        return;
      case 'NIL':
        nilImmediate(vm, tokenizer, currentDefinition);
        return;
      case 'capsule':
        beginCapsuleImmediate(vm, tokenizer, currentDefinition);
        return;
      default:
        // Immediate builtin with runtime semantics (e.g., immdup)
        executeOp(vm, value as Op);
        return;
    }
  }

  if (tag === Tag.CODE) {
    // If encoded value < 128, it's invalid X1516 format, so treat as builtin immediate word
    if (value < 128) {
      // Dispatch by name (same as Tag.BUILTIN case)
      switch (name) {
        case ':':
          beginDefinitionImmediate(vm, tokenizer, currentDefinition);
          return;
        case 'if':
          beginIfImmediate(vm, tokenizer, currentDefinition);
          return;
        case ';':
          if (vm.sp - STACK_BASE === 0) {
            throw new SyntaxError('Unexpected semicolon', getStackData(vm));
          }
          evalOp(vm);
          return;
        case 'else':
          beginElseImmediate(vm, tokenizer, currentDefinition);
          return;
        case 'match':
          beginMatchImmediate(vm, tokenizer, currentDefinition);
          return;
        case 'with':
          beginWithImmediate(vm, tokenizer, currentDefinition);
          return;
        case 'case':
          beginCaseImmediate(vm, tokenizer, currentDefinition);
          return;
        case 'do':
          clauseDoImmediate(vm, tokenizer, currentDefinition);
          return;
        case 'DEFAULT':
          defaultImmediate(vm, tokenizer, currentDefinition);
          return;
        case 'NIL':
          nilImmediate(vm, tokenizer, currentDefinition);
          return;
        case 'capsule':
          beginCapsuleImmediate(vm, tokenizer, currentDefinition);
          return;
        default:
          // Immediate builtin with runtime semantics (e.g., immdup)
          executeOp(vm, value as Op);
          return;
      }
    }
    // Otherwise, decode X1516 and run as immediate code block
    const decodedAddress = decodeX1516(value);
    runImmediateCode(vm, decodedAddress);
    return;
  }

  throw new SyntaxError(`Immediate word ${name} is not executable`, getStackData(vm));
}

export function runImmediateCode(vm: VM, address: number): void {
  const savedIP = vm.IP;
  const savedBP = vm.bp;
  const savedRSPRel = rdepth(vm);
  const savedRunning = vm.running;
  const savedCP = vm.compiler.CP;
  const savedBCP = vm.compiler.BCP;
  const savedPreserve = vm.compiler.preserve;

  rpush(vm, savedIP);
  // Save BP (relative cells) and set new frame
  rpush(vm, vm.bp - RSTACK_BASE);
  vm.bp = vm.rsp;
  vm.IP = address;
  vm.running = true;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (vm.running) {
    const firstByte = vm.memory.read8(SEG_CODE, vm.IP);
    const isUserDefined = (firstByte & 0x80) !== 0;
    const opcode = nextOpcode(vm);
    executeOp(vm, opcode as Op, isUserDefined);
    if (vm.IP === savedIP && rdepth(vm) === savedRSPRel) {
      break;
    }
  }

  vm.running = savedRunning;
  vm.IP = savedIP;
  vm.bp = savedBP;
  vm.compiler.CP = savedCP;
  vm.compiler.BCP = savedBCP;
  vm.compiler.preserve = savedPreserve;
}
