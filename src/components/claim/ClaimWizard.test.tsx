// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClaimPolicyOption } from "@/types/database";

const { routerPushMock } = vi.hoisted(() => ({ routerPushMock: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPushMock }),
}));

import { ClaimWizard } from "@/components/claim/ClaimWizard";

function policy(
  id: string,
  number: string,
  make: string,
  accessType: "DIRECT" | "LINKED" = "DIRECT",
): ClaimPolicyOption {
  return {
    policyId: id,
    policyNumber: number,
    coverageType: "COMPREHENSIVE",
    excessAmount: 150,
    coverageLimit: 9_500,
    startDate: "2026-01-01",
    endDate: "2027-01-01",
    status: "ACTIVE",
    accessType,
    vehicle: {
      id: `${id}-vehicle`,
      make,
      model: make === "Toyota" ? "Corolla" : "Patrol",
      year: 2026,
      plateNumber: make === "Toyota" ? "927410" : "345678",
    },
  };
}

const directPolicy = policy(
  "11111111-1111-4111-8111-111111111111",
  "MOT-2026-DIRECT",
  "Toyota",
);
const linkedPolicy = policy(
  "22222222-2222-4222-8222-222222222222",
  "MOT-2026-LINKED",
  "Nissan",
  "LINKED",
);

function renderWizard(policies: ClaimPolicyOption[]) {
  return render(
    <ClaimWizard
      initialEmail="customer@example.com"
      initialPhone="+973 3900 0000"
      policies={policies}
      policyLoadError={null}
    />,
  );
}

describe("ClaimWizard saved policy selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:preview"),
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows direct and linked saved policies and requires an explicit choice when multiple exist", async () => {
    const user = userEvent.setup();
    renderWizard([directPolicy, linkedPolicy]);

    const direct = screen.getByRole("radio", { name: /MOT-2026-DIRECT/ });
    const linked = screen.getByRole("radio", { name: /MOT-2026-LINKED/ });
    expect((direct as HTMLInputElement).checked).toBe(false);
    expect((linked as HTMLInputElement).checked).toBe(false);

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Choose a policy to continue.")).toBeTruthy();

    await user.click(linked);
    expect((linked as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByText("Choose a policy to continue.")).toBeNull();
  });

  it("preserves the selected policy when moving forward and back", async () => {
    const user = userEvent.setup();
    renderWizard([directPolicy, linkedPolicy]);
    const linked = screen.getByRole("radio", { name: /MOT-2026-LINKED/ });

    await user.click(linked);
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Accident details")).toBeTruthy();
    expect(screen.getByText("Claiming under")).toBeTruthy();
    expect(screen.getByText("MOT-2026-LINKED")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect((screen.getByRole("radio", { name: /MOT-2026-LINKED/ }) as HTMLInputElement).checked).toBe(true);
  });

  it("preselects a single eligible policy while still showing its context", () => {
    renderWizard([directPolicy]);
    expect((screen.getByRole("radio", { name: /MOT-2026-DIRECT/ }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText("Toyota Corolla (2026)")).toBeTruthy();
    expect(screen.getByText("927410")).toBeTruthy();
  });

  it("shows a useful empty state instead of a dead-end form", () => {
    renderWizard([]);
    expect(screen.getByText("No eligible policies found")).toBeTruthy();
    expect(screen.getByText("You need an active motor policy before you can submit a claim.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Link a policy" }).getAttribute("href")).toBe("/dashboard/policies/link");
    expect(screen.getByRole("link", { name: "Get a policy" }).getAttribute("href")).toBe("/dashboard/policies/new");
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
  });

  it("submits the selected persisted policy ID through the existing claim request", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ ok: true, claimNumber: "CLM-2026-ABC123" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    renderWizard([directPolicy]);

    await user.click(screen.getByRole("button", { name: "Continue" }));
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    fireEvent.change(screen.getByLabelText("Accident date"), { target: { value: yesterday } });
    await user.type(screen.getByLabelText("Accident location"), "Manama Highway");
    await user.type(screen.getByLabelText("Accident description"), "The vehicle was struck from behind.");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    const repair = new File(["repair"], "repair.pdf", { type: "application/pdf" });
    const photo = new File(["photo"], "accident.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText("Repair estimate (required)"), repair);
    await user.upload(screen.getByLabelText("Accident photos (required, multiple allowed)"), photo);
    await user.click(screen.getByRole("button", { name: "Continue to review" }));
    await user.click(screen.getByRole("button", { name: "Submit Claim" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = request.body as FormData;
    expect(body.get("policyId")).toBe(directPolicy.policyId);
    expect(body.get("policyNumber")).toBeNull();
    expect(body.get("repairEstimate")).toBe(repair);
    expect(body.getAll("accidentPhotos")).toEqual([photo]);
    expect(routerPushMock).toHaveBeenCalledWith("/claim/success?claimNumber=CLM-2026-ABC123");
  });
});
