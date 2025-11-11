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
import type { VM, Verb } from '@src/core';
import { SyntaxError } from '@src/core';
import { getStackData } from '../core/vm';
import { Op } from './opcodes';

import { STACK_BASE } from '@src/core';
import { evalOp } from './core';

// Immediate word functions are handled in executeImmediateWord, not here
import { gpushOp, gpopOp, gpeekOp } from './heap';
import {
  defineOp,
  lookupOp,
  markOp,
  forgetOp,
  dictFirstOnOp,
  dictFirstOffOp,
  dumpDictOp,
  define,
} from '@src/core/dictionary';
import { toTaggedValue, Tag } from '@src/core';

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
 * @param enableAnalytics - Whether to print analytics (default: true, set to false in tests)
 */
export function registerBuiltins(vm: VM): void {
  // All registration goes directly to dictionary
  function reg(name: string, opcode: number, _implementation?: Verb, isImmediate = false): void {
    define(vm, name, toTaggedValue(opcode, Tag.BUILTIN, isImmediate ? 1 : 0));
  }

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
  reg('gpush', Op.GPush, gpushOp);
  reg('gpop', Op.GPop, gpopOp);
  reg('gpeek', Op.GPeek, gpeekOp);

  // Heap-backed dictionary ops (independent of legacy internals)
  reg('define', Op.Define, defineOp);
  reg('lookup', Op.Lookup, lookupOp);
  reg('mark', Op.Mark, markOp);
  reg('forget', Op.Forget, forgetOp);
  // Toggle dict-first symbol lookup resolution
  reg('dict-first-on', Op.DictFirstOn, dictFirstOnOp);
  reg('dict-first-off', Op.DictFirstOff, dictFirstOffOp);
  // Debug
  reg('dump-dict', Op.DumpDict, dumpDictOp);

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

  reg('if', Op.Nop, undefined, true);
  reg('else', Op.Nop, undefined, true);
  reg('match', Op.Nop, undefined, true);
  reg('with', Op.Nop, undefined, true);
  reg('case', Op.Nop, undefined, true);
  reg('do', Op.Nop, undefined, true);
  reg('DEFAULT', Op.Nop, undefined, true);
  reg('NIL', Op.Nop, undefined, true);
  // Capsule opener: 'capsule'
  reg('capsule', Op.Nop, undefined, true);

  reg('select', Op.Select);
  reg('makeList', Op.MakeList);

  reg(':', Op.Nop, undefined, true);
  reg(
    ';',
    Op.Nop,
    vmInstance => {
      if (vmInstance.sp - STACK_BASE === 0) {
        throw new SyntaxError('Unexpected semicolon', getStackData(vmInstance));
      }
      evalOp(vmInstance);
    },
    true,
  );
}
