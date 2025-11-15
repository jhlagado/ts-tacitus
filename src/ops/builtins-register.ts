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
import { Op } from './opcodes';
import { evalOp } from './core';

import {
  beginDefinitionImmediate,
  beginIfImmediate,
  beginElseImmediate,
  beginMatchImmediate,
  beginWithImmediate,
  beginCaseImmediate,
  clauseDoImmediate,
  beginCapsuleImmediate,
  registerImmediateHandler,
  resetImmediateHandlers,
  semicolonImmediate,
  type ImmediateHandler,
} from '../lang/meta';
import { tokenNextOp } from '../lang/meta/token-bridge';
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
import { Tagged, Tag } from '@src/core';
import { Tokenizer } from '../lang/tokenizer';
import { parse } from '../lang/parser';

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
  resetImmediateHandlers();
  // All registration goes directly to dictionary
  function reg(
    name: string,
    opcode: number,
    _implementation?: Verb,
    isImmediate = false,
    immediateHandler?: ImmediateHandler,
  ): void {
    // Use Tag.CODE instead of Tag.BUILTIN for unified dispatch
    // Values < 128 are stored directly and treated as builtin opcodes
    define(vm, name, Tagged(opcode, Tag.CODE, isImmediate ? 1 : 0));
    if (isImmediate && immediateHandler) {
      registerImmediateHandler(opcode, immediateHandler);
    }
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
  reg('token-next', Op.TokenNext, tokenNextOp);
  reg('sentinel', Op.SentinelEncode);
  reg('emit-number', Op.EmitNumberWord);
  reg('emit-string', Op.EmitStringWord);
  reg('handle-special', Op.HandleSpecialWord);
  reg('emit-word', Op.EmitWordCall);
  reg('emit-symbol', Op.EmitSymbolWord);
  reg('emit-ref-sigil', Op.EmitRefSigilWord);
  reg('finalize-compile', Op.FinalizeCompile);
  reg('unexpected-token', Op.UnexpectedTokenWord);

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

  reg('if', Op.BeginIfImmediate, undefined, true, beginIfImmediate);
  reg('else', Op.BeginElseImmediate, undefined, true, beginElseImmediate);
  reg('match', Op.BeginMatchImmediate, undefined, true, beginMatchImmediate);
  reg('with', Op.BeginWithImmediate, undefined, true, beginWithImmediate);
  reg('case', Op.BeginCaseImmediate, undefined, true, beginCaseImmediate);
  reg('do', Op.ClauseDoImmediate, undefined, true, clauseDoImmediate);
  reg('DEFAULT', Op.Nop, undefined, true);
  reg('NIL', Op.Nop, undefined, true);
  // Capsule opener: 'capsule'
  reg('capsule', Op.BeginCapsuleImmediate, undefined, true, beginCapsuleImmediate);

  reg('select', Op.Select);
  reg('makeList', Op.MakeList);

  reg(':', Op.BeginDefinitionImmediate, undefined, true, beginDefinitionImmediate);
  reg(';', Op.SemicolonImmediate, undefined, true, semicolonImmediate);

  // Tacit compile loop will be injected once the Tacit-side definitions exist.
}
