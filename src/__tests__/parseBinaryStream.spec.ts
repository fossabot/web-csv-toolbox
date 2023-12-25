import { fc } from "@fast-check/vitest";
import { describe, expect, it } from "vitest";
import { SingleValueReadableStream } from "../internal/SingleValueReadableStream";
import { escapeField } from "../internal/escapeField";
import { parseBinaryStream } from "../parseBinaryStream.js";
import { FC } from "./helper";

describe("parseBinaryStream function", () => {
  it("should parse CSV", () =>
    fc.assert(
      fc.asyncProperty(
        fc.gen().map((g) => {
          const header = g(FC.header, {
            // TextEncoderStream can't handle utf-16 string.
            fieldConstraints: {
              kindExcludes: ["string16bits"],
            },
          });
          const EOL = g(FC.eol);
          const csvData = g(FC.csvData, {
            // TextEncoderStream can't handle utf-16 string.
            fieldConstraints: {
              kindExcludes: ["string16bits"],
            },
            columnsConstraints: {
              minLength: header.length,
              maxLength: header.length,
            },
          });
          const EOF = g(fc.boolean);
          const csv = [
            header.map((v) => escapeField(v, { quate: true })).join(","),
            ...csvData.map((row) =>
              row.map((v) => escapeField(v, { quate: true })).join(","),
            ),
            ...(EOF ? [""] : []),
          ].join(EOL);
          const data =
            csvData.length >= 1
              ? csvData.map((row) =>
                  Object.fromEntries(row.map((v, i) => [header[i], v])),
                )
              : [];
          return {
            data,
            csv: new SingleValueReadableStream(csv).pipeThrough(
              new TextEncoderStream(),
            ),
          };
        }),
        async ({ data, csv }) => {
          let i = 0;
          for await (const row of parseBinaryStream(csv)) {
            expect(data[i++]).toStrictEqual(row);
          }
        },
      ),
    ));

  it("should parse CSV with BOM", async () => {
    const csv = new SingleValueReadableStream("\uFEFFa,b,c\n1,2,3").pipeThrough(
      new TextEncoderStream(),
    );
    const expected = [{ a: "1", b: "2", c: "3" }];
    let i = 0;
    for await (const row of parseBinaryStream(csv)) {
      expect(row).toStrictEqual(expected[i++]);
    }
  });

  it("should parse CSV with BOM and EOL", async () => {
    const csv = new SingleValueReadableStream(
      "\uFEFFa,b,c\r\n1,2,3\r\n",
    ).pipeThrough(new TextEncoderStream());
    const expected = [{ a: "1", b: "2", c: "3" }];
    let i = 0;
    for await (const row of parseBinaryStream(csv)) {
      expect(row).toStrictEqual(expected[i++]);
    }
  });

  it("should parse decompressed CSV", () =>
    fc.assert(
      fc.asyncProperty(
        fc.gen().map((g) => {
          const header = g(FC.header, {
            // TextEncoderStream can't handle utf-16 string.
            fieldConstraints: {
              kindExcludes: ["string16bits"],
            },
          });
          const EOL = g(FC.eol);
          const csvData = g(FC.csvData, {
            // TextEncoderStream can't handle utf-16 string.
            fieldConstraints: {
              kindExcludes: ["string16bits"],
            },
            columnsConstraints: {
              minLength: header.length,
              maxLength: header.length,
            },
          });
          const EOF = g(fc.boolean);
          const csv = [
            header.map((v) => escapeField(v, { quate: true })).join(","),
            ...csvData.map((row) =>
              row.map((v) => escapeField(v, { quate: true })).join(","),
            ),
            ...(EOF ? [""] : []),
          ].join(EOL);
          const data =
            csvData.length >= 1
              ? csvData.map((row) =>
                  Object.fromEntries(row.map((v, i) => [header[i], v])),
                )
              : [];
          const decompression = g(() =>
            fc.constantFrom<CompressionFormat>(
              "gzip",
              "deflate",
              // NOTE: Node.js doesn't support raw deflate.
              // "deflate-raw",
            ),
          );
          return {
            data,
            csv: new SingleValueReadableStream(csv)
              .pipeThrough(new TextEncoderStream())
              .pipeThrough(new CompressionStream(decompression)),
            decompression: decompression,
          };
        }),
        async ({ data, csv, decompression }) => {
          let i = 0;
          for await (const row of parseBinaryStream(csv, {
            decomposition: decompression,
          })) {
            expect(data[i++]).toStrictEqual(row);
          }
        },
      ),
    ));
});
