import { describe, expect, test } from "bun:test";

import {
  parseMapping,
  mapCsvRowToImportRecord,
  MappingError,
  hasMappedValue,
} from "../importer";

describe("parseMapping", () => {
  test("normalizes supported destination columns", () => {
    const mapping = parseMapping(
      JSON.stringify({
        HEXACLE: "Hexacle",
        Numero: "NUMERO",
        City: "ville",
        Unknown: "IGNORED",
      }),
    );

    expect(Array.from(mapping.entries())).toEqual([
      ["hexacle", "HEXACLE"],
      ["numero", "Numero"],
      ["ville", "City"],
    ]);
  });

  test("throws a mapping error when JSON is invalid", () => {
    expect(() => parseMapping("not-json")).toThrow(MappingError);
  });

  test("throws a mapping error when no supported columns are provided", () => {
    expect(() =>
      parseMapping(
        JSON.stringify({
          foo: "bar",
        }),
      ),
    ).toThrow(MappingError);
  });
});

describe("mapCsvRowToImportRecord", () => {
  test("returns a sanitized import record", () => {
    const mapping = parseMapping(
      JSON.stringify({
        HEXACLE: "Hexacle",
        Numero: "NUMERO",
        Rue: "VOIE",
        City: "ville",
        Postal: "cod_post",
        Insee: "COD_INSEE",
      }),
    );

    const record = mapCsvRowToImportRecord(
      {
        HEXACLE: " 123 ",
        Numero: 7,
        Rue: " Av. de la République ",
        City: "Paris",
        Postal: "",
        Insee: null,
      },
      mapping,
      99,
    );

    expect(record).toEqual({
      source_id: "99",
      hexacle: "123",
      numero: "7",
      voie: "Av. de la République",
      ville: "Paris",
      cod_post: null,
      cod_insee: null,
    });
  });

  test("identifies when a record has no mapped values", () => {
    const mapping = parseMapping(
      JSON.stringify({
        HEXACLE: "Hexacle",
      }),
    );

    const record = mapCsvRowToImportRecord(
      {
        HEXACLE: "   ",
      },
      mapping,
      1,
    );

    expect(hasMappedValue(record, mapping)).toBe(false);
  });
});
