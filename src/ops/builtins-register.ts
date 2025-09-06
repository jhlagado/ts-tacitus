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
 * - Conditional operations (if, ifcurlybf)
 */
import { VM } from '@src/core';
import { Op } from './opcodes';
import { SymbolTable } from '../strings/symbol-table';

import { evalOp } from './core';

import { doOp } from './combinators/do';
import { repeatOp } from './combinators/repeat';

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
  symbolTable.defineBuiltin('eval', Op.Eval, evalOp);
  symbolTable.defineBuiltin('pushSymbolRef', Op.PushSymbolRef);
  symbolTable.defineBuiltin('.', Op.Print);
  symbolTable.defineBuiltin('raw', Op.RawPrint);
  symbolTable.defineBuiltin('str', Op.LiteralString);
  symbolTable.defineBuiltin('addr', Op.LiteralAddress);

  /** Parentheses build unified LIST. */
  symbolTable.defineBuiltin('(', Op.OpenList);
  symbolTable.defineBuiltin(')', Op.CloseList);

  /** List operations (Sections 9 & 10). */
  symbolTable.defineBuiltin('length', Op.Length);
  symbolTable.defineBuiltin('size', Op.Size);
  symbolTable.defineBuiltin('slot', Op.Slot);
  symbolTable.defineBuiltin('elem', Op.Elem);
  symbolTable.defineBuiltin('fetch', Op.Fetch);
  symbolTable.defineBuiltin('store', Op.Store);

  /** Structural operations (concat unified). */
  symbolTable.defineBuiltin('concat', Op.Concat);
  symbolTable.defineBuiltin('tail', Op.Tail);
  symbolTable.defineBuiltin('head', Op.Head);
  symbolTable.defineBuiltin('pack', Op.Pack);
  symbolTable.defineBuiltin('unpack', Op.Unpack);
  symbolTable.defineBuiltin('reverse', Op.Reverse);

  /** Maplist operations. */
  symbolTable.defineBuiltin('find', Op.Find);
  symbolTable.defineBuiltin('keys', Op.Keys);
  symbolTable.defineBuiltin('values', Op.Values);

  /** Reference operations. */
  symbolTable.defineBuiltin('ref', Op.Ref);
  symbolTable.defineBuiltin('resolve', Op.Resolve);
  symbolTable.defineBuiltin('load', Op.Load);
  symbolTable.defineBuiltin('varRef', Op.VarRef);
  symbolTable.defineBuiltin('dumpStackFrame', Op.DumpStackFrame);

  symbolTable.defineBuiltin('add', Op.Add);
  symbolTable.defineBuiltin('sub', Op.Minus);
  symbolTable.defineBuiltin('mul', Op.Multiply);
  symbolTable.defineBuiltin('div', Op.Divide);
  /** Canonical pow. */
  symbolTable.defineBuiltin('mod', Op.Mod);
  symbolTable.defineBuiltin('min', Op.Min);
  symbolTable.defineBuiltin('max', Op.Max);
  symbolTable.defineBuiltin('lt', Op.LessThan);
  symbolTable.defineBuiltin('le', Op.LessOrEqual);
  symbolTable.defineBuiltin('gt', Op.GreaterThan);
  symbolTable.defineBuiltin('ge', Op.GreaterOrEqual);
  symbolTable.defineBuiltin('eq', Op.Equal);

  /** Canonical neg maps to Op.Neg. */
  symbolTable.defineBuiltin('recip', Op.Recip);
  symbolTable.defineBuiltin('floor', Op.Floor);
  symbolTable.defineBuiltin('not', Op.Not);
  symbolTable.defineBuiltin('enlist', Op.Enlist);

  symbolTable.defineBuiltin('dup', Op.Dup);
  symbolTable.defineBuiltin('drop', Op.Drop);
  symbolTable.defineBuiltin('swap', Op.Swap);
  symbolTable.defineBuiltin('rot', Op.Rot);
  symbolTable.defineBuiltin('revrot', Op.RevRot);
  symbolTable.defineBuiltin('over', Op.Over);
  symbolTable.defineBuiltin('pick', Op.Pick);
  symbolTable.defineBuiltin('nip', Op.Nip);
  symbolTable.defineBuiltin('tuck', Op.Tuck);

  symbolTable.defineBuiltin('abs', Op.Abs);
  symbolTable.defineBuiltin('neg', Op.Neg);
  symbolTable.defineBuiltin('sign', Op.Sign);
  symbolTable.defineBuiltin('exp', Op.Exp);
  symbolTable.defineBuiltin('ln', Op.Ln);
  symbolTable.defineBuiltin('log', Op.Log);
  symbolTable.defineBuiltin('sqrt', Op.Sqrt);
  symbolTable.defineBuiltin('pow', Op.Pow);
  /** Non-core math ops not included. */

  symbolTable.defineBuiltin('if', Op.SimpleIf);
  symbolTable.defineBuiltin('ifcurlybf', Op.IfFalseBranch);

  symbolTable.defineBuiltin('do', Op.Do, doOp);
  symbolTable.defineBuiltin('repeat', Op.Repeat, repeatOp);
  symbolTable.defineBuiltin('get', Op.Get);
  symbolTable.defineBuiltin('set', Op.Set);
  symbolTable.defineBuiltin('select', Op.Select);
  symbolTable.defineBuiltin('makeList', Op.MakeList);
}
