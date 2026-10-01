// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { Field, TextInput } from "./Forms";
import { VehicleMakeAutocomplete } from "@/components/dashboard/VehicleAutocomplete";

afterEach(cleanup);
it("associates help and errors with the labelled control without losing existing descriptions", () => {
  const view = render(<><p id="context">Existing context</p><Field label="Email" htmlFor="test-email" hint="Use your account email."><div><TextInput id="test-email" aria-describedby="context" /></div></Field></>);
  const input = screen.getByRole("textbox", { name: "Email" });
  expect(input.getAttribute("aria-describedby")).toBe("context test-email-hint");
  expect(document.getElementById("test-email-hint")?.textContent).toBe("Use your account email.");
  view.rerender(<Field label="Email" htmlFor="test-email" error="Enter a valid email."><TextInput id="test-email" /></Field>);
  expect(screen.getByRole("textbox").getAttribute("aria-invalid")).toBe("true");
  expect(screen.getByRole("textbox").getAttribute("aria-describedby")).toBe("test-email-error");
  expect(screen.getByRole("alert").id).toBe("test-email-error");
  view.rerender(<Field label="Email" htmlFor="test-email"><TextInput id="test-email" /></Field>);
  expect(screen.getByRole("textbox").getAttribute("aria-invalid")).not.toBe("true");
});
it("forwards field semantics through vehicle autocomplete", () => {
  render(<Field label="Make" htmlFor="make" error="Enter the vehicle make." required><VehicleMakeAutocomplete id="make" value="" onChange={() => {}} /></Field>);
  const input = screen.getByRole("combobox", { name: "Make" });
  expect(input.getAttribute("aria-describedby")).toBe("make-error");
  expect(input.getAttribute("aria-invalid")).toBe("true");
  expect(input.getAttribute("aria-required")).toBe("true");
});
