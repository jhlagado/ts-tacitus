import { SymbolTable } from '../strings/symbol-table';
import { VM } from '../core/vm';
import { Op } from './opcodes';

/**
 * Defines the built-in functions in the given symbol table.
 * This function maps symbolic names (strings) to their corresponding opcodes,
 * allowing the Tacit interpreter to recognize and execute these functions.
 * @param {SymbolTable} dict The symbol table to populate with built-in functions.
 */
export const defineBuiltins = (dict: SymbolTable) => {
  /**
   * Creates a compiler function for a given opcode.
   * This function, when called by the interpreter, will emit the specified opcode
   * into the program's bytecode.
   * @param {number} opcode The opcode to compile.
   * @returns {(vm: VM) => void} A function that, when executed, compiles the opcode.
   */
  const compileOpcode = (opcode: number) => (vm: VM) => {
    vm.compiler.compile8(opcode);
  };

  dict.define('{', compileOpcode(Op.DictLeft));
  dict.define('}', compileOpcode(Op.DictRight));
  dict.define('[', (vm: VM) => vm.compiler.compile8(Op.VecLeft));
  dict.define(']', (vm: VM) => vm.compiler.compile8(Op.VecRight));

  // Control Flow
  dict.define('eval', compileOpcode(Op.Eval));
  dict.define('.', compileOpcode(Op.Print));

  // Dyadic Arithmetic
  dict.define('+', compileOpcode(Op.Plus));
  dict.define('-', compileOpcode(Op.Minus));
  dict.define('*', compileOpcode(Op.Multiply));
  dict.define('/', compileOpcode(Op.Divide));
  dict.define('&', compileOpcode(Op.Min));
  dict.define('|', compileOpcode(Op.Max));
  dict.define('^', compileOpcode(Op.Power));
  dict.define('=', compileOpcode(Op.Equal));
  dict.define('<', compileOpcode(Op.LessThan));
  dict.define('>', compileOpcode(Op.GreaterThan));
  dict.define('~', compileOpcode(Op.Match));
  dict.define('!', compileOpcode(Op.Mod));

  // Monadic Arithmetic
  dict.define('m-', compileOpcode(Op.mNegate));
  dict.define('m%', compileOpcode(Op.mReciprocal));
  dict.define('m_', compileOpcode(Op.mFloor));
  dict.define('m~', compileOpcode(Op.mNot));
  dict.define('m*', compileOpcode(Op.mSignum));
  dict.define('m,', compileOpcode(Op.mEnlist));

  // Stack Operations
  dict.define('dup', compileOpcode(Op.Dup));
  dict.define('drop', compileOpcode(Op.Drop));
  dict.define('swap', compileOpcode(Op.Swap));

  // Arithmetic Operators
  dict.define('abs', compileOpcode(Op.Abs));
  dict.define('neg', compileOpcode(Op.Neg));
  dict.define('sign', compileOpcode(Op.Sign));
  dict.define('exp', compileOpcode(Op.Exp));
  dict.define('ln', compileOpcode(Op.Ln));
  dict.define('log', compileOpcode(Op.Log));
  dict.define('sqrt', compileOpcode(Op.Sqrt));
  dict.define('pow', compileOpcode(Op.Pow));
  dict.define('avg', compileOpcode(Op.Avg));
  dict.define('prod', compileOpcode(Op.Prod));

  // Conditional Operations
  dict.define('if', (vm: VM) => {
    vm.compiler.compile8(Op.Rot);
    vm.compiler.compile8(Op.Eval);
    vm.compiler.compile8(Op.NegRot);
    vm.compiler.compile8(Op.If);
  });

  // Sequence Operations
  dict.define('range', compileOpcode(Op.Range));
  dict.define('seq', compileOpcode(Op.Seq));

  // Sequence Processors
  dict.define('map', compileOpcode(Op.Map));
  dict.define('sift', compileOpcode(Op.Sift));
  dict.define('filter', compileOpcode(Op.Filter));
  dict.define('seq-take', compileOpcode(Op.SeqTake));
  dict.define('seq-drop', compileOpcode(Op.SeqDrop));

  // Sequence Sinks
  dict.define('to-vector', compileOpcode(Op.ToVector));
  dict.define('count', compileOpcode(Op.Count));
  dict.define('last', compileOpcode(Op.Last));
  dict.define('for-each', compileOpcode(Op.ForEach));
  dict.define('reduce', compileOpcode(Op.Reduce));

  // Add other built-ins here
};
