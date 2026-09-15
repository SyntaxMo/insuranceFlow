import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MAX_AUTOCOMPLETE_SUGGESTIONS,
  VEHICLE_CATALOG,
  VEHICLE_CATALOG_MODEL_COUNT,
  filterVehicleMakes,
  filterVehicleModels,
  findVehicleMake,
} from "@/lib/vehicles/catalog";

describe("local vehicle catalog", () => {
  it("contains a broad but lightweight GCC-oriented selection", () => {
    expect(VEHICLE_CATALOG.length).toBeGreaterThanOrEqual(25);
    expect(VEHICLE_CATALOG.length).toBeLessThanOrEqual(40);
    expect(VEHICLE_CATALOG_MODEL_COUNT).toBeGreaterThan(150);
    expect(VEHICLE_CATALOG.every((make) => Boolean(make.logo))).toBe(true);
    for (const make of VEHICLE_CATALOG) {
      expect(existsSync(join(process.cwd(), "public", make.logo!.replace(/^\//, ""))), make.name).toBe(true);
    }
  });

  it("matches makes case-insensitively with prefix results first", () => {
    expect(filterVehicleMakes("K").map((make) => make.name)).toContain("Kia");
    expect(filterVehicleMakes("toy")[0]?.name).toBe("Toyota");
    expect(findVehicleMake("  kIa ")?.name).toBe("Kia");
  });

  it("limits rendered candidates and filters models by an exact recognized make", () => {
    expect(filterVehicleMakes("").length).toBeLessThanOrEqual(MAX_AUTOCOMPLETE_SUGGESTIONS);
    expect(filterVehicleModels("kia", "sor")).toEqual(["Sorento"]);
    expect(filterVehicleModels("CustomBrand", "model")).toEqual([]);
  });

  it("includes expected common Bahrain and GCC models while remaining curated", () => {
    expect(findVehicleMake("Honda")?.models).toEqual(expect.arrayContaining([
      "Accord",
      "Civic",
      "CR-V",
      "Pilot",
      "HR-V",
      "City",
    ]));
    expect(findVehicleMake("Toyota")?.models).toEqual(expect.arrayContaining(["Corolla Cross", "Raize", "Innova"]));
    expect(findVehicleMake("Kia")?.models).toEqual(expect.arrayContaining(["Picanto", "Sonet", "Carens"]));
    expect(findVehicleMake("Nissan")?.models).toEqual(expect.arrayContaining(["Sentra", "Magnite"]));
    expect(VEHICLE_CATALOG_MODEL_COUNT).toBeLessThan(350);
  });
});
