import { RecordAssembler } from "./RecordAssembler.ts";
import { CSVRecord, RecordAssemblerOptions, Token } from "./common/types.ts";

/**
 * A transform stream that converts a stream of tokens into a stream of rows.
 * @template Header The type of the header row.
 * @param options The options for the parser.
 *
 * @category Low-level API
 *
 * @example Parse a CSV with headers by data
 *  ```ts
 * new ReadableStream({
 *   start(controller) {
 *     controller.enqueue("name,age\r\n");
 *     controller.enqueue("Alice,20\r\n");
 *     controller.enqueue("Bob,25\r\n");
 *     controller.enqueue("Charlie,30\r\n");
 *     controller.close();
 *   })
 *   .pipeThrough(new LexerTransformer())
 *   .pipeThrough(new RecordAssemblerTransformer())
 *   .pipeTo(new WritableStream({ write(row) { console.log(row); }}));
 * // { name: "Alice", age: "20" }
 * // { name: "Bob", age: "25" }
 * // { name: "Charlie", age: "30" }
 * ```
 *
 * @example Parse a CSV with headers by options
 * ```ts
 * new ReadableStream({
 *   start(controller) {
 *     controller.enqueue("Alice,20\r\n");
 *     controller.enqueue("Bob,25\r\n");
 *     controller.enqueue("Charlie,30\r\n");
 *     controller.close();
 *   }
 * })
 * .pipeThrough(new LexerTransformer())
 * .pipeThrough(new RecordAssemblerTransformer({ header: ["name", "age"] }))
 * .pipeTo(new WritableStream({ write(row) { console.log(row); }}));
 * // { name: "Alice", age: "20" }
 * // { name: "Bob", age: "25" }
 * // { name: "Charlie", age: "30" }
 * ```
 */
export class RecordAssemblerTransformer<
  Header extends ReadonlyArray<string>,
> extends TransformStream<Token[], CSVRecord<Header>> {
  constructor(options: RecordAssemblerOptions<Header> = {}) {
    const assembler = new RecordAssembler(options);
    super({
      transform: (tokens, controller) => {
        for (const token of assembler.assemble(tokens, false)) {
          controller.enqueue(token);
        }
      },
      flush: (controller) => {
        for (const token of assembler.flush()) {
          controller.enqueue(token);
        }
      },
    });
  }
}
