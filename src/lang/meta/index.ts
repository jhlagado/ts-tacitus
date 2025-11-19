import { SyntaxError } from '@src/core';
import { getStackData, type VM } from '../../core/vm';
import { Op } from '../../ops/opcodes';
import { beginDefinitionImmediateOp, recurseImmediateOp } from './definitions';
import { beginIfImmediateOp, beginElseImmediateOp, ensureNoOpenConditionals } from './conditionals';
import { runImmediateCode, semicolonImmediateOp } from './executor';
import { beginMatchImmediateOp, beginWithImmediateOp } from './match-with';
import {
  beginCaseImmediateOp,
  clauseDoImmediateOp,
  defaultImmediateOp,
  nilImmediateOp,
} from './case';
import { beginCapsuleImmediateOp } from './capsules';
import {
  varImmediateOp,
  assignImmediateOp,
  globalImmediateOp,
  incrementImmediateOp,
} from './variables';

export {
  beginDefinitionImmediateOp,
  recurseImmediateOp,
  beginIfImmediateOp,
  beginElseImmediateOp,
  ensureNoOpenConditionals,
  runImmediateCode,
  semicolonImmediateOp,
  beginMatchImmediateOp,
  beginWithImmediateOp,
  beginCaseImmediateOp,
  clauseDoImmediateOp,
  defaultImmediateOp,
  nilImmediateOp,
  beginCapsuleImmediateOp,
  varImmediateOp,
  assignImmediateOp,
  globalImmediateOp,
  incrementImmediateOp,
};

type ImmediateHandler = (vm: VM) => void;

const IMMEDIATE_HANDLERS: Partial<Record<number, ImmediateHandler>> = {
  [Op.BeginDefinitionImmediate]: beginDefinitionImmediateOp,
  [Op.SemicolonImmediate]: semicolonImmediateOp,
  [Op.RecurseImmediate]: recurseImmediateOp,
  [Op.BeginIfImmediate]: beginIfImmediateOp,
  [Op.BeginElseImmediate]: beginElseImmediateOp,
  [Op.BeginMatchImmediate]: beginMatchImmediateOp,
  [Op.BeginWithImmediate]: beginWithImmediateOp,
  [Op.BeginCaseImmediate]: beginCaseImmediateOp,
  [Op.ClauseDoImmediate]: clauseDoImmediateOp,
  [Op.BeginCapsuleImmediate]: beginCapsuleImmediateOp,
  [Op.VarImmediate]: varImmediateOp,
  [Op.AssignImmediate]: assignImmediateOp,
  [Op.GlobalImmediate]: globalImmediateOp,
  [Op.IncrementImmediate]: incrementImmediateOp,
  [Op.DefaultImmediate]: defaultImmediateOp,
  [Op.NilImmediate]: nilImmediateOp,
};

export function isBuiltinImmediateOpcode(opcode: number): boolean {
  return Object.prototype.hasOwnProperty.call(IMMEDIATE_HANDLERS, opcode);
}

export function executeImmediateOpcode(vm: VM, opcode: number): void {
  const handler = IMMEDIATE_HANDLERS[opcode];
  if (!handler) {
    throw new SyntaxError(`Unknown immediate opcode: ${opcode}`, getStackData(vm));
  }
  handler(vm);
}
