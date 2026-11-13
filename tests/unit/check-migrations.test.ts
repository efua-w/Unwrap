import { describe, expect, it } from "vitest";
import { compareMigrations, localVersions } from "../../scripts/check-migrations.ts";

describe("db:drift (audit finding 1)", () => {
  it("reads versions from migration file names and ignores anything else", () => {
    expect(localVersions(["20261105024047_wishlists.sql", "20261104080111_harden_defaults.sql", ".gitkeep", "notes.md"])).toEqual([
      "20261104080111",
      "20261105024047",
    ]);
  });

  it("finds nothing when the files and the ledger match", () => {
    expect(compareMigrations(["1", "2"], ["2", "1"])).toEqual({ pending: [], unknown: [] });
  });

  it("reports a file the project has not recorded as pending", () => {
    expect(compareMigrations(["1", "2", "3"], ["1", "2"])).toEqual({ pending: ["3"], unknown: [] });
  });

  it("reports a recorded version with no file as unknown", () => {
    expect(compareMigrations(["1"], ["1", "9"])).toEqual({ pending: [], unknown: ["9"] });
  });
});
