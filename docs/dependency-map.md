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
- `./refs`
- `./list`

## core/globalState.ts
- `./vm`
- `../lang/compiler`

## core/index.ts
_No imports_

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
- `@src/core`
- `./tokenizer`

## lang/parser.ts
- `../ops/opcodes`
- `../core/globalState`
- `./tokenizer`
- `@src/core`
- `@src/core`

## lang/repl.ts
- `readline`
- `./executor`
- `./fileProcessor`

## lang/tokenizer.ts
- `@src/core`

## ops/access/get-set-ops.ts
- `@src/core`
- `../core`
- `../../core/list`
- `@src/core`

## ops/access/index.ts
_No imports_

## ops/access/select-ops.ts
- `@src/core`
- `../../core/list`
- `@src/core`
- `../lists`
- `../stack`

## ops/builtins-register.ts
- `../core/vm`
- `./opcodes`
- `../strings/symbol-table`
- `./core`
- `./combinators/do`
- `./combinators/repeat`

## ops/builtins.ts
- `../core/vm`
- `../core/tagged`
- `../core/refs`
- `../core/constants`
- `./core`
- `./math`
- `./lists`
- `./stack`
- `./print`
- `./control`
- `./lists`
- `./lists`
- `./lists`
- `./lists`
- `./lists`
- `./opcodes`
- `../core/errors`
- `./control`
- `./combinators/do`
- `./combinators/repeat`
- `./access`
- `./local-vars-transfer`

## ops/control/conditional-ops.ts
- `@src/core`

## ops/control/index.ts
_No imports_

## ops/core/core-ops.ts
- `@src/core`
- `../builtins`
- `../../core/format-utils`

## ops/core/index.ts
_No imports_

## ops/lists/build-ops.ts
- `@src/core`
- `../../core/list`
- `./core-helpers`
- `../core`
- `@src/core`

## ops/lists/core-helpers.ts
- `@src/core`
- `../../core/list`

## ops/lists/index.ts
_No imports_

## ops/lists/query-ops.ts
- `@src/core`
- `../../core/list`
- `@src/core`
- `./core-helpers`
- `@src/core`
- `../stack`
- `../local-vars-transfer`
- `@src/core`

## ops/lists/structure-ops.ts
- `@src/core`
- `../../core/list`
- `./core-helpers`
- `@src/core`
- `../stack`

## ops/local-vars-transfer.ts
- `../core/vm`
- `../core/tagged`
- `../core/list`
- `../core/constants`
- `../core/list`

## ops/math/arithmetic-ops.ts
- `@src/core`

## ops/math/comparison-ops.ts
- `@src/core`

## ops/math/index.ts
_No imports_

## ops/opcodes.ts
_No imports_

## ops/print/index.ts
_No imports_

## ops/print/print-ops.ts
- `@src/core`
- `../../core/format-utils`

## ops/stack/data-move-ops.ts
- `../../core/vm`
- `../../core/types`
- `../../core/tagged`
- `../../core/constants`
- `../../core/errors`

## ops/stack/index.ts
_No imports_

## strings/digest.ts
- `../core/memory`
- `../core/constants`

## strings/index.ts
_No imports_

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
- `@src/core`
- `../../ops/opcodes`

## test/core/code-ref.test.ts
- `@src/core`
- `../utils/core-test-utils`
- `@src/core`
- `../../ops/opcodes`
- `@src/core`

## test/core/format-utils.coverage.test.ts
- `../../core/globalState`
- `@src/core`
- `@src/core`

## test/core/format-utils.test.ts
- `@src/core`
- `../../core/globalState`
- `@src/core`
- `../utils/vm-test-utils`

## test/core/list-memory.test.ts
- `@jest/globals`
- `../../core/globalState`
- `../../lang/interpreter`
- `@src/core`

## test/core/list.coverage.test.ts
- `../../core/globalState`
- `@src/core`
- `@src/core`

## test/core/list.test.ts
- `@src/core`
- `@src/core`
- `../utils/core-test-utils`

## test/core/memory.test.ts
- `@src/core`

## test/core/printer.test.ts
- `../utils/core-test-utils`
- `@src/core`

## test/core/reference-formatting.test.ts
- `@jest/globals`
- `../utils/vm-test-utils`

## test/core/tagged-local.test.ts
- `@src/core`

## test/core/tagged-meta.test.ts
- `@src/core`

## test/core/tagged.test.ts
- `@src/core`

## test/core/unified-references.test.ts
- `@jest/globals`
- `../../core/globalState`
- `@src/core`
- `../../ops/lists`
- `@src/core`

## test/core/utils.test.ts
- `@src/core`
- `@src/core`
- `@src/core`

## test/core/vm-comprehensive-testing.test.ts
- `../utils/vm-test-utils`
- `../../core/globalState`
- `../../ops/core`
- `../../core/tagged`
- `../../ops/opcodes`

## test/core/vm-constructor.test.ts
- `@jest/globals`
- `../../../src/core/vm`
- `../../../src/core/memory`
- `../../../src/strings/digest`
- `../../../src/strings/symbol-table`
- `../../../src/core/tagged`
- `../../../src/lang/compiler`

## test/core/vm-ip-operations.test.ts
- `@jest/globals`
- `@src/core`
- `../../ops/opcodes`
- `../../core/globalState`

## test/core/vm-push-symbol-ref.test.ts
- `../utils/vm-test-utils`
- `../../core/globalState`
- `../../ops/core`
- `../../ops/opcodes`
- `@src/core`

## test/core/vm-receiver-register.test.ts
- `@src/core`
- `../../lang/compiler`
- `../utils/vm-test-utils`

## test/core/vm-stack-operations.test.ts
- `@jest/globals`
- `@src/core`
- `../../core/globalState`

## test/core/vm-symbol-resolution.test.ts
- `../../core/globalState`
- `../utils/vm-test-utils`
- `../../ops/opcodes`
- `@src/core`
- `@src/core`
- `../utils/core-test-utils`
- `../../ops/core`

## test/core/vm-unified-dispatch.test.ts
- `../../core/globalState`
- `../utils/vm-test-utils`
- `@src/core`
- `@src/core`
- `../../ops/opcodes`
- `../../ops/core`

## test/core/vm.test.ts
- `@src/core`
- `../../lang/compiler`
- `@src/strings`
- `@src/core`

## test/integration/advancedOperations.test.ts
- `../utils/vm-test-utils`

## test/integration/basicOperations.test.ts
- `../utils/vm-test-utils`

## test/integration/symbol-table-integration.test.ts
- `../../core/globalState`
- `../utils/vm-test-utils`
- `../../ops/opcodes`
- `@src/core`
- `@src/core`
- `../utils/core-test-utils`
- `../../ops/core`

## test/lang/clean-exit-test.test.ts
- `@jest/globals`
- `../../core/globalState`
- `../utils/vm-test-utils`

## test/lang/compile-code-block.test.ts
- `../../lang/interpreter`
- `../../core/globalState`
- `@src/core`
- `../utils/vm-test-utils`

## test/lang/compiler-coverage.test.ts
- `@jest/globals`
- `../../core/globalState`
- `../../lang/compiler`
- `@src/core`

## test/lang/compiler-functions.test.ts
- `@jest/globals`
- `../../core/globalState`
- `../utils/vm-test-utils`
- `../../ops/opcodes`
- `@src/core`

## test/lang/compiler.test.ts
- `../../ops/opcodes`
- `../../core/globalState`
- `@src/core`

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
- `@src/core`

## test/lang/interpreter.test.ts
- `../../lang/interpreter`
- `../../core/globalState`
- `../../ops/math/arithmetic-ops`
- `@src/core`

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
- `@src/core`

## test/lang/local-vars-integration.test.ts
- `@jest/globals`
- `../../core/globalState`
- `../utils/vm-test-utils`

## test/lang/parser-list.test.ts
- `@jest/globals`
- `../../core/globalState`
- `../../lang/interpreter`
- `@src/core`
- `../../lang/tokenizer`
- `../../lang/parser`

## test/lang/parser-redefinition.test.ts
- `../../lang/interpreter`
- `../utils/vm-test-utils`

## test/lang/parser-symbol.test.ts
- `../utils/vm-test-utils`
- `../../core/globalState`
- `@src/core`

## test/lang/parser-variables.test.ts
- `@jest/globals`
- `../../core/globalState`
- `../utils/vm-test-utils`
- `@src/core`

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

## test/lang/ref-sigil.test.ts
- `@jest/globals`
- `../utils/vm-test-utils`

## test/lang/repl.coverage.test.ts
- `@jest/globals`
- `../../lang/repl`

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

## test/ops/access/access-ops.test.ts
- `@jest/globals`
- `../../utils/vm-test-utils`
- `../../../core/globalState`
- `../../../ops/access/get-set-ops`
- `../../../core/tagged`

## test/ops/access/select-helper-functions.test.ts
- `@jest/globals`
- `../../utils/vm-test-utils`
- `../../../core/tagged`

## test/ops/access/select-op.test.ts
- `../../utils/vm-test-utils`
- `../../../core/tagged`
- `../../../ops/access/select-ops`
- `../../../ops/lists/query-ops`
- `../../../core/refs`
- `../../../core/globalState`

## test/ops/arithmetic/arithmetic.test.ts
- `../../../core/globalState`
- `../../../lang/interpreter`
- `../../../ops/math`
- `../../utils/vm-test-utils`

## test/ops/arithmetic/unary-operations.test.ts
- `@jest/globals`
- `../../../core/globalState`
- `../../../ops/math`
- `../../../ops/lists`

## test/ops/comparison/comparison.test.ts
- `@jest/globals`
- `../../../core/vm`
- `../../../core/globalState`
- `../../../ops/math`

## test/ops/conditional/conditionals.test.ts
- `@jest/globals`
- `../../../core/globalState`
- `../../../lang/interpreter`

## test/ops/control/control-ops.test.ts
- `../../../ops/control`
- `@jest/globals`
- `../../../core/globalState`
- `../../../ops/control`
- `../../../core/tagged`

## test/ops/core/core-ops-coverage.test.ts
- `@jest/globals`
- `../../utils/vm-test-utils`
- `../../../core/globalState`
- `../../../ops/core`
- `../../../core/tagged`

## test/ops/core/temp-register-opcodes.test.ts
- `../../../core/vm`
- `../../../ops/opcodes`
- `../../../core/tagged`
- `../../../ops/builtins`

## test/ops/error-handling/invalid-slot-access.test.ts
- `@jest/globals`
- `../../../core/globalState`
- `../../../core/errors`
- `../../../core/tagged`
- `../../../core/constants`
- `../../../core/refs`
- `../../../ops/lists`
- `../../../ops/builtins`
- `../../../ops/opcodes`

## test/ops/interpreter/interpreter-operations.test.ts
- `../../../ops/math`
- `../../../ops/stack`
- `../../../core/globalState`
- `../../../core/tagged`
- `../../../core/utils`
- `../../../ops/opcodes`
- `../../../ops/core`

## test/ops/lists/build/list-creation.test.ts
- `@jest/globals`
- `../../../../core/tagged`
- `../../../utils/vm-test-utils`
- `../../../../core/globalState`

## test/ops/lists/build/open-close-parser-integration.test.ts
- `@jest/globals`
- `../../../utils/vm-test-utils`

## test/ops/lists/build/pack-unpack.test.ts
- `@jest/globals`
- `../../../utils/vm-test-utils`

## test/ops/lists/integration/language-integration.test.ts
- `@jest/globals`
- `../../../../core/tagged`
- `../../../utils/vm-test-utils`

## test/ops/lists/integration/stack-interactions.test.ts
- `@jest/globals`
- `../../../utils/vm-test-utils`
- `../../../../core/globalState`
- `../../../../ops/stack`
- `../../../../ops/lists`
- `../../../../core/refs`
- `../../../../core/tagged`

## test/ops/lists/list-ops-coverage.test.ts
- `../../../core/tagged`
- `@jest/globals`
- `../../../core/globalState`
- `../../../ops/lists`
- `../../../core/tagged`

## test/ops/lists/list-spec-compliance.test.ts
- `@jest/globals`
- `../../utils/vm-test-utils`
- `../../../core/tagged`
- `../../../core/list`

## test/ops/lists/query/addressing-slot-elem.test.ts
- `@jest/globals`
- `../../../utils/vm-test-utils`

## test/ops/lists/query/fetch-store.test.ts
- `@jest/globals`
- `../../../../core/globalState`
- `../../../utils/vm-test-utils`
- `../../../../ops/lists`
- `../../../../core/tagged`

## test/ops/lists/query/find-maplist-basic.test.ts
- `@jest/globals`
- `../../../utils/vm-test-utils`

## test/ops/lists/query/length-size.test.ts
- `@jest/globals`
- `../../../utils/vm-test-utils`

## test/ops/lists/structure/concat-basic.test.ts
- `../../../utils/vm-test-utils`

## test/ops/lists/structure/concat-polymorphic.test.ts
- `@jest/globals`
- `../../../utils/vm-test-utils`

## test/ops/lists/structure/head-tail-uncons.test.ts
- `@jest/globals`
- `../../../utils/vm-test-utils`

## test/ops/lists/structure/reverse.test.ts
- `@jest/globals`
- `../../../utils/vm-test-utils`

## test/ops/local-vars/compatibility.test.ts
- `@jest/globals`
- `../../../core/globalState`
- `../../utils/vm-test-utils`
- `../../../ops/local-vars-transfer`
- `../../../core/tagged`
- `../../../core/list`

## test/ops/local-vars/compound-mutation.test.ts
- `@jest/globals`
- `../../../core/globalState`
- `../../utils/vm-test-utils`

## test/ops/local-vars/compound-var.test.ts
- `@jest/globals`
- `../../../core/globalState`
- `../../utils/vm-test-utils`
- `../../../core/list`

## test/ops/local-vars/in-place-mutation.test.ts
- `@jest/globals`
- `../../../core/globalState`
- `../../utils/vm-test-utils`
- `../../../ops/local-vars-transfer`
- `../../../core/tagged`
- `../../../core/list`
- `../../../core/constants`

## test/ops/local-vars/initvar.test.ts
- `@jest/globals`
- `../../../core/globalState`
- `../../../ops/builtins`
- `../../../core/constants`

## test/ops/local-vars/local-variables.test.ts
- `@jest/globals`
- `../../../core/globalState`
- `../../../ops/builtins`
- `../../../ops/lists`
- `../../../core/refs`

## test/ops/local-vars/reserve.test.ts
- `../../../ops/builtins`
- `../../../core/globalState`

## test/ops/print/print-operations.test.ts
- `../../utils/vm-test-utils`

## test/ops/stack/drop.test.ts
- `../../../core/tagged`
- `../../../core/globalState`
- `../../../ops/stack`
- `../../utils/vm-test-utils`

## test/ops/stack/dup.test.ts
- `../../../core/tagged`
- `../../../core/globalState`
- `../../../ops/stack`
- `../../utils/vm-test-utils`

## test/ops/stack/nip.test.ts
- `../../../core/globalState`
- `../../../ops/stack`
- `../../utils/vm-test-utils`

## test/ops/stack/over.test.ts
- `../../../core/tagged`
- `../../../core/globalState`
- `../../../ops/stack`
- `../../utils/vm-test-utils`

## test/ops/stack/pick.test.ts
- `../../../core/tagged`
- `../../../core/globalState`
- `../../../ops/stack`
- `../../utils/vm-test-utils`

## test/ops/stack/revrot.test.ts
- `../../../core/tagged`
- `../../../core/globalState`
- `../../../ops/stack`
- `../../utils/vm-test-utils`

## test/ops/stack/rot.test.ts
- `../../../core/tagged`
- `../../../core/globalState`
- `../../../ops/stack`
- `../../utils/vm-test-utils`

## test/ops/stack/stack-utils.test.ts
- `@jest/globals`
- `../../../core/vm`
- `../../../core/constants`
- `../../../core/tagged`
- `../../../ops/stack`

## test/ops/stack/swap.test.ts
- `../../../core/tagged`
- `../../../core/globalState`
- `../../../ops/stack`
- `../../utils/vm-test-utils`

## test/ops/stack/tuck.test.ts
- `../../../core/globalState`
- `../../../ops/stack`
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
- `../../../core/vm`
- `../../../ops/builtins-register`

## test/repl/list-repl.test.ts
- `@jest/globals`
- `../utils/vm-test-utils`

## test/setupTests.ts
- `jest`

## test/stack/find.test.ts
- `@jest/globals`
- `@src/core`
- `../../ops/stack`

## test/stack/slots.test.ts
- `@jest/globals`
- `@src/core`
- `../../ops/stack`

## test/strings/symbol-table-direct-addressing.test.ts
- `../../core/globalState`
- `../utils/vm-test-utils`
- `@src/strings`
- `@src/core`
- `../../ops/opcodes`

## test/strings/symbol-table-local.test.ts
- `@src/strings`
- `@src/core`

## test/strings/symbol-table-shadowing.test.ts
- `@src/strings`
- `@src/core`

## test/tacitTestUtils.test.ts
- `./utils/vm-test-utils`

## test/utils/access-test-utils.ts
- `./vm-test-utils`

## test/utils/core-test-utils.ts
- `@src/core`

## test/utils/vm-test-utils.ts
- `@src/core`
- `../../lang/tokenizer`
- `../../lang/parser`
- `../../lang/interpreter`
- `../../core/globalState`
