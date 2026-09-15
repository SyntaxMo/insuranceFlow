// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { VehicleBrandMark, VehicleMakeAutocomplete, VehicleModelAutocomplete } from "@/components/dashboard/VehicleAutocomplete";

function MakeHarness() {
  const [value, setValue] = useState("");
  return <><label htmlFor="make">Make</label><VehicleMakeAutocomplete value={value} onChange={setValue} /></>;
}

function VehicleHarness() {
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  return (
    <>
      <label htmlFor="make">Make</label><VehicleMakeAutocomplete value={make} onChange={setMake} />
      <label htmlFor="model">Model</label><VehicleModelAutocomplete make={make} value={model} onChange={setModel} />
    </>
  );
}

describe("vehicle autocomplete", () => {
  afterEach(cleanup);

  it("filters makes locally, selects canonical casing, and closes the list", async () => {
    const user = userEvent.setup();
    render(<MakeHarness />);
    const input = screen.getByLabelText("Make");
    await user.type(input, "k");
    expect(screen.getByRole("option", { name: "Kia" })).toBeTruthy();
    await user.click(screen.getByRole("option", { name: "Kia" }));
    expect((input as HTMLInputElement).value).toBe("Kia");
    expect(input.getAttribute("aria-expanded")).toBe("false");
  });

  it("uses one neutral vehicle mark instead of make-specific initials when a logo is unavailable", () => {
    render(<VehicleBrandMark />);
    const fallback = screen.getByTestId("vehicle-brand-fallback");
    expect(fallback.getAttribute("src")).toContain("/vehicle-brands/generic-vehicle.svg");
    expect(screen.queryByText(/^[A-Z]{2}$/)).toBeNull();
  });

  it("keeps unknown makes as free text", async () => {
    const user = userEvent.setup();
    render(<MakeHarness />);
    const input = screen.getByLabelText("Make") as HTMLInputElement;
    await user.type(input, "CustomBrand");
    expect(input.value).toBe("CustomBrand");
    expect(screen.queryByRole("option")).toBeNull();
  });

  it("filters models from a typed known make and preserves the model when make changes", async () => {
    const user = userEvent.setup();
    render(<VehicleHarness />);
    const make = screen.getByLabelText("Make") as HTMLInputElement;
    const model = screen.getByLabelText("Model") as HTMLInputElement;
    await user.type(make, "kia");
    await user.type(model, "sor");
    await user.click(screen.getByRole("option", { name: "Sorento" }));
    expect(model.value).toBe("Sorento");

    await user.clear(make);
    await user.type(make, "Toyota");
    expect(model.value).toBe("Sorento");
    await user.clear(model);
    await user.type(model, "cam");
    expect(screen.getByRole("option", { name: "Camry" })).toBeTruthy();
  });

  it("allows a free-typed model for an unknown make", async () => {
    const user = userEvent.setup();
    render(<VehicleHarness />);
    await user.type(screen.getByLabelText("Make"), "CustomBrand");
    const model = screen.getByLabelText("Model") as HTMLInputElement;
    await user.type(model, "CustomModel");
    expect(model.value).toBe("CustomModel");
  });

  it("supports Arrow Down, Arrow Up, Enter, and Escape", async () => {
    const user = userEvent.setup();
    render(<MakeHarness />);
    const input = screen.getByLabelText("Make") as HTMLInputElement;
    await user.type(input, "toy");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(input.value).toBe("Toyota");

    await user.clear(input);
    await user.type(input, "kia");
    await user.keyboard("{ArrowUp}{Enter}");
    expect(input.value).toBe("Kia");

    await user.clear(input);
    await user.type(input, "k");
    expect(input.getAttribute("aria-expanded")).toBe("true");
    await user.keyboard("{Escape}");
    expect(input.getAttribute("aria-expanded")).toBe("false");
  });
});
