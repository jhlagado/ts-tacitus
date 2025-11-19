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
import type { VM } from '@src/core';
import { Op } from './opcodes';

import {
  define,
} from '@src/core/dictionary';
import { Tagged, Tag } from '@src/core';

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
  function reg(name: string, opcode: number, meta = 0): void {
    // Use Tag.CODE instead of Tag.BUILTIN for unified dispatch
    // Values < 128 are stored directly and treated as builtin opcodes
    define(vm, name, Tagged(opcode, Tag.CODE, meta));
  }

  // Language immediates (meta=1 so they execute during compilation)
  reg(':', Op.BeginDefinitionImmediate, 1);
  reg(';', Op.SemicolonImmediate, 1);
  reg('recurse', Op.RecurseImmediate, 1);
  reg('if', Op.BeginIfImmediate, 1);
  reg('else', Op.BeginElseImmediate, 1);
  reg('match', Op.BeginMatchImmediate, 1);
  reg('with', Op.BeginWithImmediate, 1);
  reg('case', Op.BeginCaseImmediate, 1);
  reg('do', Op.ClauseDoImmediate, 1);
  reg('capsule', Op.BeginCapsuleImmediate, 1);
  reg('var', Op.VarImmediate, 1);
  reg('global', Op.GlobalImmediate, 1);
  reg('->', Op.AssignImmediate, 1);
  reg('+>', Op.IncrementImmediate, 1);
  reg('DEFAULT', Op.DefaultImmediate, 1);
  reg('NIL', Op.NilImmediate, 1);

  reg('eval', Op.Eval);
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

  /** Buffer operations. */
  reg('buffer', Op.Buffer);
  reg('buf-size', Op.BufSize);
  reg('is-empty', Op.BufEmpty);
  reg('is-full', Op.BufFull);
  reg('write', Op.BufPush);
  reg('unwrite', Op.BufPop);
  reg('read', Op.BufShift);
  reg('unread', Op.BufUnshift);
  // Aliases
  reg('push', Op.BufPush); // Alias for write
  reg('pop', Op.BufPop); // Alias for unwrite
  reg('shift', Op.BufShift); // Alias for read
  reg('unshift', Op.BufUnshift); // Alias for unread

  /** Reference operations. */
  reg('ref', Op.Ref);
  // 'resolve' removed in favor of 'load'
  reg('load', Op.Load);
  reg('varRef', Op.VarRef);
  reg('dumpStackFrame', Op.DumpStackFrame);
  reg('gpush', Op.GPush);
  reg('gpop', Op.GPop);
  reg('gpeek', Op.GPeek);

  // Heap-backed dictionary ops (independent of legacy internals)
  reg('define', Op.Define);
  reg('lookup', Op.Lookup);
  reg('mark', Op.Mark);
  reg('forget', Op.Forget);
  // Toggle dict-first symbol lookup resolution
  reg('dict-first-on', Op.DictFirstOn);
  reg('dict-first-off', Op.DictFirstOff);
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

  reg('select', Op.Select);
  reg('makeList', Op.MakeList);
}
