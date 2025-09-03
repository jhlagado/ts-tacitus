# TypeScript Dependency Map

This file is auto-generated. It lists all imports for each TS file in `src/`.

## cli.ts
- `./lang/repl`
- `./lang/fileProcessor`
- `./core/globalState`

## core/code-ref.ts
- `./tagged`
- `./constants`

## core/constants.ts
_No imports_

## core/errors.ts
_No imports_

## core/format-utils.ts
- `./vm`
- `./tagged`

## core/globalState.ts
- `./vm`
- `../lang/compiler`

## core/list.ts
- `./vm`
- `./tagged`
- `./constants`

## core/memory.ts
- `./constants`

## core/refs.ts
- `./vm`
- `./tagged`
- `./constants`

## core/tagged.ts
_No imports_

## core/types.ts
- `./vm`

## core/utils.ts
- `./tagged`
- `./vm`

## core/vm.ts
- `../lang/compiler`
- `../strings/symbol-table`
- `./memory`
- `./constants`
- `./tagged`
- `../strings/digest`
- `../ops/builtins-register`
- `./errors`

## lang/compiler.ts
- `../core/vm`
- `../core/tagged`
- `../core/constants`
- `../core/errors`
- `../ops/opcodes`

## lang/executor.ts
- `./tokenizer`
- `./parser`
- `./interpreter`
- `../core/globalState`

## lang/fileProcessor.ts
- `fs`
- `path`
- `./executor`

## lang/interpreter.ts
- `../ops/builtins`
- `../core/globalState`
- `./parser`
- `../core/tagged`
- `./tokenizer`
- `../core/constants`

## lang/parser.ts
- `../ops/opcodes`
- `../core/globalState`
- `./tokenizer`
- `../core/utils`
- `../core/tagged`
- `../core/errors`

## lang/repl.ts
- `readline`
- `./executor`
- `./fileProcessor`

## lang/tokenizer.ts
- `../core/errors`
- `../core/utils`

## ops/access-ops.ts
- `../core/vm`
- `../core/types`
- `../core/tagged`
- `./core-ops`
- `../core/list`

## ops/builtins-register.ts
- `../core/vm`
- `./opcodes`
- `../strings/symbol-table`
- `./core-ops`
- `./combinators/do`
- `./combinators/repeat`

## ops/builtins.ts
- `../core/vm`
- `../core/tagged`
- `../core/refs`
- `../core/constants`
- `./core-ops`
- `./math-ops`
- `./math-ops`
- `./list-ops`
- `./stack-ops`
- `./print-ops`
- `./control-ops`
- `./list-ops`
- `./list-ops`
- `./opcodes`
- `../core/errors`
- `./control-ops`
- `./combinators/do`
- `./combinators/repeat`
- `./access-ops`
- `./local-vars-transfer`

## ops/combinators/do.ts
- `../../core/vm`
- `../../core/types`
- `../core-ops`

## ops/combinators/repeat.ts
- `../../core/vm`
- `../../core/types`
- `../../core/tagged`
- `../core-ops`

## ops/control-ops.ts
- `../core/vm`
- `../core/types`
- `../core/tagged`

## ops/core-ops.ts
- `../core/vm`
- `../core/errors`
- `../core/types`
- `../core/tagged`
- `../core/constants`
- `./builtins`
- `../core/utils`

## ops/define-builtins.ts
- `../strings/symbol-table`
- `./opcodes`

## ops/lists/*
- `../core/vm`
- `../core/tagged`
- `../core/refs`
- `./core-ops`
- `../core/constants`
- `../core/types`
- `../core/errors`
- `../core/list`

## ops/local-vars-transfer.ts
- `../core/vm`
- `../core/tagged`
- `../core/list`
- `../core/constants`
- `../core/list`

## ops/math-ops.ts
- `../core/vm`
- `../core/types`

## ops/opcodes.ts
_No imports_

## ops/print-ops.ts
- `../core/vm`
- `../core/tagged`
- `../core/constants`
- `../core/format-utils`

## ops/stack-ops.ts
- `../core/vm`
- `../core/types`
- `../core/tagged`
- `../core/constants`
- `../core/errors`

## strings/digest.ts
- `../core/memory`
- `../core/constants`

## strings/string.ts
- `./digest`
- `../core/tagged`

## strings/symbol-table.ts
- `./digest`
- `../core/vm`
- `../core/tagged`
- `../core/code-ref`

## test/cli/cli.test.ts
- `../../cli`
- `../../lang/repl`
- `../../lang/fileProcessor`

## test/cli/print-cli-test.ts
- `../utils/vm-test-utils`

## test/core/builtin-tag.test.ts
- `../../core/tagged`
- `../../ops/opcodes`

## test/core/code-ref.test.ts
- `../../core/code-ref`
- `../utils/core-test-utils`
- `../../core/tagged`
- `../../ops/opcodes`
- `../../core/constants`

## test/core/format-utils.test.ts
- `../../core/format-utils`
- `../../core/globalState`
- `../../core/tagged`
- `../utils/vm-test-utils`

## test/core/list-memory.test.ts
- `@jest/globals`
- `../../core/globalState`
- `../../lang/interpreter`
- `../../core/tagged`

## test/core/list.test.ts
- `../../core/vm`
- `../../core/tagged`
- `../../core/list`
- `../utils/core-test-utils`

## test/core/memory.test.ts
- `../../core/memory`
- `../../core/constants`

## test/core/printer.test.ts
- `../utils/core-test-utils`
- `../../core/tagged`

## test/core/tagged-local.test.ts
- `../../core/tagged`

## test/core/tagged-meta.test.ts
- `../../core/tagged`

## test/core/tagged.test.ts
- `../../core/tagged`

## test/core/unified-references.test.ts
- `@jest/globals`
- `../../core/globalState`
- `../../core/tagged`
- `../../ops/lists`
- `../../ops/builtins`

## test/core/utils.test.ts
- `../../core/utils`
- `../../core/tagged`
- `../../core/vm`

## test/core/vm-comprehensive-testing.test.ts
- `../utils/vm-test-utils`
- `../../core/globalState`
- `../../ops/core-ops`
- `../../core/tagged`
- `../../ops/opcodes`

## test/core/vm-push-symbol-ref.test.ts
- `../utils/vm-test-utils`
- `../../core/globalState`
- `../../ops/core-ops`
- `../../ops/opcodes`
- `../../core/tagged`

## test/core/vm-receiver-register.test.ts
- `../../core/vm`
- `../../lang/compiler`
- `../utils/vm-test-utils`

## test/core/vm-symbol-resolution.test.ts
- `../../core/globalState`
- `../utils/vm-test-utils`
- `../../ops/opcodes`
- `../../core/tagged`
- `../../core/tagged`
- `../../core/code-ref`
- `../utils/core-test-utils`
- `../../ops/core-ops`

## test/core/vm-unified-dispatch.test.ts
- `../../core/globalState`
- `../utils/vm-test-utils`
- `../../core/code-ref`
- `../../core/tagged`
- `../../ops/opcodes`
- `../../ops/core-ops`

## test/core/vm.test.ts
- `../../core/vm`
- `../../core/constants`
- `../../lang/compiler`
- `../../strings/symbol-table`
- `../../core/tagged`

## test/integration/advancedOperations.test.ts
- `../utils/vm-test-utils`

## test/integration/basicOperations.test.ts
- `../utils/vm-test-utils`

## test/integration/symbol-table-integration.test.ts
- `../../core/globalState`
- `../utils/vm-test-utils`
- `../../ops/opcodes`
- `../../core/tagged`
- `../../core/code-ref`
- `../utils/core-test-utils`
- `../../ops/core-ops`

## test/jest.d.ts
_No imports_

## test/lang/clean-exit-test.test.ts
- `@jest/globals`
- `../../core/globalState`
- `../utils/vm-test-utils`

## test/lang/compile-code-block.test.ts
- `../../lang/interpreter`
- `../../core/globalState`
- `../../core/tagged`

## test/lang/compiler-coverage.test.ts
- `@jest/globals`
- `../../core/globalState`
- `../../lang/compiler`
- `../../core/constants`

## test/lang/compiler-functions.test.ts
- `@jest/globals`
- `../../core/globalState`
- `../utils/vm-test-utils`
- `../../ops/opcodes`
- `../../core/constants`

## test/lang/compiler.test.ts
- `../../ops/opcodes`
- `../../core/globalState`
- `../../core/tagged`

## test/lang/end-to-end-local-vars.test.ts
- `@jest/globals`
- `../../core/globalState`
- `../utils/vm-test-utils`

## test/lang/executor.test.ts
- `../../lang/executor`
- `../../lang/parser`
- `../../lang/interpreter`
- `../../lang/tokenizer`
- `../../core/globalState`

## test/lang/fileProcessor.test.ts
- `fs`
- `path`
- `../../lang/fileProcessor`
- `../../lang/executor`

## test/lang/interpreter-coverage.test.ts
- `@jest/globals`
- `../../core/globalState`
- `../../lang/interpreter`
- `../../core/constants`

## test/lang/interpreter.test.ts
- `../../lang/interpreter`
- `../../core/globalState`
- `../../ops/math-ops`
- `../../core/constants`

## test/lang/list-compilation.test.ts
- `@jest/globals`
- `../../core/globalState`
- `../../lang/tokenizer`
- `../../lang/parser`
- `../../ops/opcodes`

## test/lang/local-vars-code-blocks.test.ts
- `@jest/globals`
- `../../core/globalState`
- `../utils/vm-test-utils`

## test/lang/local-vars-error-handling.test.ts
- `@jest/globals`
- `../../core/globalState`
- `../utils/vm-test-utils`
- `../../core/errors`

## test/lang/local-vars-integration.test.ts
- `@jest/globals`
- `../../core/globalState`
- `../utils/vm-test-utils`

## test/lang/parser-list.test.ts
- `@jest/globals`
- `../../core/globalState`
- `../../lang/interpreter`
- `../../core/tagged`
- `../../lang/tokenizer`
- `../../lang/parser`

## test/lang/parser-redefinition.test.ts
- `../../lang/interpreter`
- `../utils/vm-test-utils`

## test/lang/parser-symbol.test.ts
- `../utils/vm-test-utils`
- `../../core/globalState`
- `../../core/tagged`

## test/lang/parser-variables.test.ts
- `@jest/globals`
- `../../core/globalState`
- `../utils/vm-test-utils`
- `../../core/tagged`

## test/lang/parser.comprehensive.test.ts
- `../../ops/opcodes`
- `../../core/globalState`
- `../../lang/parser`
- `../../lang/tokenizer`
- `../../lang/interpreter`

## test/lang/parser.test.ts
- `../../ops/opcodes`
- `../../core/globalState`
- `../../lang/parser`
- `../../lang/tokenizer`

## test/lang/repl.test.ts
- `readline`
- `../../lang/repl`
- `../../lang/executor`
- `../../lang/fileProcessor`

## test/lang/standalone-blocks.test.ts
- `../../lang/interpreter`
- `../../core/globalState`

## test/lang/tokenizer-symbol.test.ts
- `../../lang/tokenizer`

## test/lang/tokenizer.test.ts
- `../../lang/tokenizer`

## test/ops/arithmetic/arithmetic.test.ts
- `../../../core/globalState`
- `../../../lang/interpreter`
- `../../../ops/math-ops`
- `../../utils/vm-test-utils`

## test/ops/arithmetic/unary-operations.test.ts
- `@jest/globals`
- `../../../core/globalState`
- `../../../ops/math-ops`
- `../../../ops/lists`

## test/ops/combinators/do.test.ts
- `../../../core/globalState`
- `../../../lang/interpreter`

## test/ops/combinators/repeat.test.ts
- `../../../core/globalState`
- `../../../lang/interpreter`

## test/ops/comparison/comparison.test.ts
- `@jest/globals`
- `../../../core/vm`
- `../../../core/globalState`
- `../../../ops/math-ops`

## test/ops/conditional/conditionals.test.ts
- `@jest/globals`
- `../../../core/globalState`
- `../../../lang/interpreter`

## test/ops/control/control-ops.test.ts
- `../../../ops/control-ops`
- `@jest/globals`
- `../../../core/globalState`
- `../../../ops/control-ops`
- `../../../core/tagged`

## test/ops/core/temp-register-opcodes.test.ts
- `../../../core/vm`
- `../../../ops/opcodes`
- `../../../core/tagged`
- `../../../ops/builtins`

## test/ops/interpreter/interpreter-operations.test.ts
- `../../../ops/math-ops`
- `../../../ops/stack-ops`
- `../../../core/globalState`
- `../../../core/tagged`
- `../../../core/utils`
- `../../../ops/opcodes`
- `../../../ops/core-ops`

## test/ops/lists/list-creation.test.ts
- `@jest/globals`
- `../../../core/tagged`
- `../../utils/vm-test-utils`

## test/ops/lists/list-integration.test.ts
- `@jest/globals`
- `../../../core/tagged`
- `../../utils/vm-test-utils`

## test/ops/lists/list-operations.test.ts
- `@jest/globals`
- `../../utils/vm-test-utils`
- `../../../core/globalState`
- `../../../ops/stack-ops`

## test/ops/lists/list-ops-coverage.test.ts
- `../../../core/tagged`
- `@jest/globals`
- `../../../core/globalState`
- `../../../ops/lists`
- `../../../core/tagged`

## test/ops/lists/list-reverse.test.ts
- `@jest/globals`
- `../../utils/vm-test-utils`

## test/ops/lists/list-spec-compliance.test.ts
- `@jest/globals`
- `../../utils/vm-test-utils`
- `../../../core/tagged`
- `../../../core/list`

## test/ops/lists/maplist-basic.test.ts
- `@jest/globals`
- `../../utils/vm-test-utils`

## test/ops/local-vars/combinators-integration.test.ts
- `@jest/globals`
- `../../../core/globalState`
- `../../../ops/builtins`
- `../../../ops/lists`
- `../../../core/tagged`
- `../../utils/vm-test-utils`

## test/ops/local-vars/end-to-end-integration.test.ts
- `@jest/globals`
- `../../../core/globalState`
- `../../../ops/builtins`
- `../../../ops/list-ops`
- `../../../core/tagged`

## test/ops/local-vars/initvar.test.ts
- `@jest/globals`
- `../../../core/globalState`
- `../../../ops/builtins`
- `../../../core/constants`

## test/ops/local-vars/reserve.test.ts
- `../../../ops/builtins`
- `../../../core/globalState`

## test/ops/local-vars-initvar-compound.test.ts
- `@jest/globals`
- `../../core/globalState`
- `../../ops/builtins`
- `../../core/tagged`
- `../../core/list`
- `../../core/constants`
- `../utils/vm-test-utils`

## test/ops/local-vars-transfer.test.ts
- `@jest/globals`
- `../../core/globalState`
- `../../ops/local-vars-transfer`
- `../../core/tagged`
- `../../core/list`
- `../../core/constants`

## test/ops/print/print-operations.test.ts
- `../../utils/vm-test-utils`

## test/ops/stack/drop.test.ts
- `../../../core/tagged`
- `../../../core/globalState`
- `../../../ops/stack-ops`
- `../../utils/vm-test-utils`

## test/ops/stack/dup.test.ts
- `../../../core/tagged`
- `../../../core/globalState`
- `../../../ops/stack-ops`
- `../../utils/vm-test-utils`

## test/ops/stack/nip.test.ts
- `../../../core/globalState`
- `../../../ops/stack-ops`
- `../../utils/vm-test-utils`

## test/ops/stack/over.test.ts
- `../../../core/tagged`
- `../../../core/globalState`
- `../../../ops/stack-ops`
- `../../utils/vm-test-utils`

## test/ops/stack/pick.test.ts
- `../../../core/tagged`
- `../../../core/globalState`
- `../../../ops/stack-ops`
- `../../utils/vm-test-utils`

## test/ops/stack/revrot.test.ts
- `../../../core/tagged`
- `../../../core/globalState`
- `../../../ops/stack-ops`
- `../../utils/vm-test-utils`

## test/ops/stack/rot.test.ts
- `../../../core/tagged`
- `../../../core/globalState`
- `../../../ops/stack-ops`
- `../../utils/vm-test-utils`

## test/ops/stack/stack-utils.test.ts
- `@jest/globals`
- `../../../core/vm`
- `../../../core/constants`
- `../../../core/tagged`
- `../../../ops/stack-ops`

## test/ops/stack/swap.test.ts
- `../../../core/tagged`
- `../../../core/globalState`
- `../../../ops/stack-ops`
- `../../utils/vm-test-utils`

## test/ops/stack/tuck.test.ts
- `../../../core/globalState`
- `../../../ops/stack-ops`
- `../../../core/tagged`
- `../../utils/vm-test-utils`

## test/ops/strings/digest.test.ts
- `../../../../src/strings/digest`
- `../../../core/memory`
- `../../../core/constants`

## test/ops/strings/string.test.ts
- `../../../core/memory`
- `../../../../src/strings/digest`
- `../../../../src/strings/string`
- `../../../core/tagged`

## test/ops/strings/symbol-table.test.ts
- `../../../core/memory`
- `../../../../src/strings/symbol-table`
- `../../../../src/strings/digest`
- `../../../ops/define-builtins`

## test/repl/list-repl.test.ts
- `@jest/globals`
- `../utils/vm-test-utils`

## test/setupTests.ts
- `jest`

## test/stack/find.test.ts
- `@jest/globals`
- `../../core/vm`
- `../../core/constants`
- `../../core/tagged`
- `../../ops/stack-ops`

## test/stack/slots.test.ts
- `@jest/globals`
- `../../core/vm`
- `../../ops/stack-ops`

## test/strings/symbol-table-direct-addressing.test.ts
- `../../core/globalState`
- `../utils/vm-test-utils`
- `../../strings/symbol-table`
- `../../strings/digest`
- `../../core/tagged`
- `../../ops/opcodes`

## test/strings/symbol-table-local.test.ts
- `../../strings/symbol-table`
- `../../strings/digest`
- `../../core/memory`
- `../../core/tagged`

## test/strings/symbol-table-shadowing.test.ts
- `../../strings/symbol-table`
- `../../strings/digest`
- `../../core/memory`
- `../../core/tagged`

## test/tacitTestUtils.test.ts
- `./utils/vm-test-utils`

## test/utils/access-test-utils.ts
- `./vm-test-utils`

## test/utils/core-test-utils.ts
- `../../core/vm`
- `../../core/tagged`

## test/utils/vm-test-utils.ts
- `../../core/vm`
- `../../core/tagged`
- `../../lang/tokenizer`
- `../../lang/parser`
- `../../lang/interpreter`
- `../../core/globalState`

