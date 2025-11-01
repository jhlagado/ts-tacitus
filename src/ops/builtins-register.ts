/**
 * @file src/ops/builtins-register.ts
 * Registers all built-in operations for the Tacit VM.
 *
 * This module serves as the central registry for all VM operations, connecting
 * operation names (as used in Tacit code) with their implementation functions and
 * opcode values. It replaces the old function table initialization approach with
 * a more flexible symbol table-based system.
 *
 * The operations are organized into several categories:
 * - Control flow operations (lit, branch, call, eval, etc.)
 * - List operations (open list, close list)
 * - Math operations (+, -, *, /, etc.)
 * - Unary operations (negate, reciprocal, floor, etc.)
 * - Stack operations (dup, drop, swap, etc.)
 * - Arithmetic operations (abs, exp, sqrt, etc.)
 * - Conditional operations (if)
 */
import { VM, SyntaxError } from '@src/core';
import { Op } from './opcodes';
import { SymbolTable } from '../strings/symbol-table';
import { defineBuiltin } from '@core/dictionary';

import { STACK_BASE_CELLS } from '@src/core';
import { evalOp } from './core';

import {
  beginDefinitionImmediate,
  beginIfImmediate,
  beginElseImmediate,
  beginWhenImmediate,
  beginDoImmediate,
  beginCaseImmediate,
  clauseOfImmediate,
  defaultImmediate,
  nilImmediate,
  beginCapsuleImmediate,
} from '../lang/meta';
import { gpushOp, gpopOp, gpeekOp, gmarkOp, gsweepOp } from './heap';
import { defineOp as dictDefineOp, lookupOp as dictLookupOp, markOp as dictMarkOp, forgetOp as dictForgetOp } from './dict';

/**
 * Registers all built-in operations in the VM's symbol table.
 *
 * This function maps operation names to their implementation functions and opcode values.
 * Each operation is defined in the symbol table with:
 * - A name string (used in Tacit source code)
 * - An opcode value (from the Op enum)
 * - An implementation function (that manipulates the VM state)
 *
 * Many operations have multiple names (aliases) to support different coding styles
 * and test coverage.
 *
 * @param vm - The virtual machine instance
 * @param symbolTable - The symbol table to register operations in
 */
export function registerBuiltins(vm: VM, symbolTable: SymbolTable): void {
  // Dual registration helper: keep SymbolTable path for compatibility,
  // and also define a limited subset into the heap-backed dictionary to avoid
  // stressing the heap while validating dictionary flows.
  function reg(name: string, opcode: Op, impl?: (vm: VM) => void, isImmediate = false): void {
    symbolTable.defineBuiltin(name, opcode, impl, isImmediate);
    // dictDefineBuiltin(vm, name, opcode, isImmediate === true);
  }

  // defineBuiltin(vm, 'eval', Op.Eval, false);
  reg('eval', Op.Eval, evalOp);
  reg('dispatch', Op.Dispatch);
  reg('pushSymbolRef', Op.PushSymbolRef);
  reg('.', Op.Print);
  reg('raw', Op.RawPrint);
  reg('str', Op.LiteralString);
  reg('addr', Op.LiteralAddress);

  /** Parentheses build unified LIST. */
  reg('(', Op.OpenList);
  reg(')', Op.CloseList);

  /** List operations (Sections 9 & 10). */
  reg('length', Op.Length);
  reg('size', Op.Size);
  reg('slot', Op.Slot);
  reg('elem', Op.Elem);
  reg('fetch', Op.Fetch);
  reg('store', Op.Store);

  /** Structural operations (concat unified). */
  reg('concat', Op.Concat);
  reg('tail', Op.Tail);
  reg('head', Op.Head);
  reg('pack', Op.Pack);
  reg('unpack', Op.Unpack);
  reg('reverse', Op.Reverse);

  /** Maplist operations. */
  reg('find', Op.Find);
  reg('keys', Op.Keys);
  reg('values', Op.Values);
  reg('walk', Op.Walk);

  /** Reference operations. */
  reg('ref', Op.Ref);
  // 'resolve' removed in favor of 'load'
  reg('load', Op.Load);
  reg('varRef', Op.VarRef);
  reg('dumpStackFrame', Op.DumpStackFrame);
  reg('gmark', Op.GMark, gmarkOp);
  reg('gsweep', Op.GSweep, gsweepOp);
  reg('gpush', Op.GPush, gpushOp);
  reg('gpop', Op.GPop, gpopOp);
  reg('gpeek', Op.GPeek, gpeekOp);

  // Heap-backed dictionary ops (independent of legacy internals)
  reg('define', Op.Define, dictDefineOp);
  reg('lookup', Op.Lookup, dictLookupOp);
  reg('mark', Op.Mark, dictMarkOp);
  reg('forget', Op.Forget, dictForgetOp);
  // Toggle dict-first symbol lookup resolution
  reg('dict-first-on', Op.DictFirstOn, (vm: VM) => vm.symbolTable.setDictFirstLookup(true));
  reg('dict-first-off', Op.DictFirstOff, (vm: VM) => vm.symbolTable.setDictFirstLookup(false));
  // Debug
  reg('dump-dict', Op.DumpDict);

  reg('add', Op.Add);
  reg('sub', Op.Minus);
  reg('mul', Op.Multiply);
  reg('div', Op.Divide);
  /** Canonical pow. */
  reg('mod', Op.Mod);
  reg('min', Op.Min);
  reg('max', Op.Max);
  reg('lt', Op.LessThan);
  reg('le', Op.LessOrEqual);
  reg('gt', Op.GreaterThan);
  reg('ge', Op.GreaterOrEqual);
  reg('eq', Op.Equal);

  /** Canonical neg maps to Op.Neg. */
  reg('recip', Op.Recip);
  reg('floor', Op.Floor);
  reg('not', Op.Not);
  reg('enlist', Op.Enlist);

  reg('dup', Op.Dup);
  reg('drop', Op.Drop);
  reg('swap', Op.Swap);
  reg('rot', Op.Rot);
  reg('revrot', Op.RevRot);
  reg('over', Op.Over);
  reg('pick', Op.Pick);
  reg('nip', Op.Nip);
  reg('tuck', Op.Tuck);

  reg('abs', Op.Abs);
  reg('neg', Op.Neg);
  reg('sign', Op.Sign);
  reg('exp', Op.Exp);
  reg('ln', Op.Ln);
  reg('log', Op.Log);
  reg('sqrt', Op.Sqrt);
  reg('pow', Op.Pow);
  /** Non-core math ops not included. */

  reg('if', Op.Nop, (_vm: VM) => beginIfImmediate(), true);
  reg('else', Op.Nop, (_vm: VM) => beginElseImmediate(), true);
  reg('when', Op.Nop, (_vm: VM) => beginWhenImmediate(), true);
  reg('do', Op.Nop, (_vm: VM) => beginDoImmediate(), true);
  reg('case', Op.Nop, (_vm: VM) => beginCaseImmediate(), true);
  reg('of', Op.Nop, (_vm: VM) => clauseOfImmediate(), true);
  reg('DEFAULT', Op.Nop, (_vm: VM) => defaultImmediate(), true);
  reg('NIL', Op.Nop, (_vm: VM) => nilImmediate(), true);
  // Capsule opener: 'capsule'
  reg('capsule', Op.Nop, (_vm: VM) => beginCapsuleImmediate(), true);

  reg('select', Op.Select);
  reg('makeList', Op.MakeList);

  reg(':', Op.Nop, (_vm: VM) => beginDefinitionImmediate(), true);
  reg(
    ';',
    Op.Nop,
    (vm: VM) => {
      if (vm.sp - STACK_BASE_CELLS === 0) {
        throw new SyntaxError('Unexpected semicolon', vm.getStackData());
      }
      evalOp(vm);
    },
    true,
  );

  // defineBuiltin(vm, 'eval', Op.Eval, false);
  // defineBuiltin(vm, 'eval', Op.Eval, false);

}
