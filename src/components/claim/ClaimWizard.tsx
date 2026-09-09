"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { VerifiedPolicySummary } from "@/types/database";
import {
  isAccidentFormValid,
  validateAccidentForm,
  validateDocuments,
  validateFile,
  type AccidentFormInput,
} from "@/lib/validation/claim";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  Alert,
  Button,
  Card,
  Field,
  TextArea,
  TextInput,
} from "@/components/ui/Forms";

type Step = 1 | 2 | 3 | 4;

const STEPS: { id: Step; label: string }[] = [
  { id: 1, label: "Policy" },
  { id: 2, label: "Accident" },
  { id: 3, label: "Documents" },
  { id: 4, label: "Review" },
];

interface SelectedFiles {
  policeReport: File | null;
  repairEstimate: File | null;
  accidentPhotos: File[];
}

function StepIndicator({ current }: { current: Step }) {
  return (
    <ol className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {STEPS.map((step) => {
        const active = step.id === current;
        const complete = step.id < current;
        return (
          <li
            key={step.id}
            className={`rounded-xl border px-3 py-2 text-sm ${
              active
                ? "border-[var(--brand-teal)] bg-[var(--brand-teal-soft)] text-[var(--brand-navy)]"
                : complete
                  ? "border-slate-200 bg-slate-50 text-slate-700"
                  : "border-slate-200 bg-white text-slate-400"
            }`}
          >
            <span className="block text-xs uppercase tracking-wide opacity-70">
              Step {step.id}
            </span>
            <span className="font-semibold">{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function PolicySummary({ policy }: { policy: VerifiedPolicySummary }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      <div>
        <dt className="text-xs uppercase tracking-wide text-slate-500">
          Policy number
        </dt>
        <dd className="font-medium text-slate-900">{policy.policyNumber}</dd>
      </div>
      <div>
        <dt className="text-xs uppercase tracking-wide text-slate-500">
          Coverage type
        </dt>
        <dd className="font-medium text-slate-900">{policy.coverageType}</dd>
      </div>
      <div>
        <dt className="text-xs uppercase tracking-wide text-slate-500">
          Vehicle
        </dt>
        <dd className="font-medium text-slate-900">
          {policy.vehicle.make} {policy.vehicle.model} ({policy.vehicle.year})
        </dd>
      </div>
      <div>
        <dt className="text-xs uppercase tracking-wide text-slate-500">
          Plate number
        </dt>
        <dd className="font-medium text-slate-900">
          {policy.vehicle.plateNumber}
        </dd>
      </div>
      <div>
        <dt className="text-xs uppercase tracking-wide text-slate-500">
          Excess amount
        </dt>
        <dd className="font-medium text-slate-900">
          {formatCurrency(policy.excessAmount)}
        </dd>
      </div>
      <div>
        <dt className="text-xs uppercase tracking-wide text-slate-500">
          Coverage limit
        </dt>
        <dd className="font-medium text-slate-900">
          {formatCurrency(policy.coverageLimit)}
        </dd>
      </div>
    </dl>
  );
}

function filePreviewUrl(file: File): string | null {
  if (!file.type.startsWith("image/")) return null;
  return URL.createObjectURL(file);
}

export function ClaimWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [policyNumber, setPolicyNumber] = useState("MOT-2026-0001");
  const [policy, setPolicy] = useState<VerifiedPolicySummary | null>(null);
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const [accident, setAccident] = useState<AccidentFormInput>({
    accidentDate: "",
    accidentLocation: "",
    description: "",
    email: "",
    phone: "",
  });
  const [accidentErrors, setAccidentErrors] = useState<
    ReturnType<typeof validateAccidentForm>
  >({});

  const [files, setFiles] = useState<SelectedFiles>({
    policeReport: null,
    repairEstimate: null,
    accidentPhotos: [],
  });
  const [fileErrors, setFileErrors] = useState<{
    policeReport?: string;
    repairEstimate?: string;
    accidentPhotos?: string;
  }>({});

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const photoPreviews = useMemo(
    () =>
      files.accidentPhotos.map((file) => ({
        name: file.name,
        url: filePreviewUrl(file),
      })),
    [files.accidentPhotos],
  );

  async function handleVerifyPolicy() {
    setPolicyError(null);
    setPolicy(null);
    setVerifying(true);

    try {
      const response = await fetch("/api/policies/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policyNumber }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        policy?: VerifiedPolicySummary;
        error?: string;
      };

      if (!payload.ok || !payload.policy) {
        setPolicyError(payload.error || "Unable to verify this policy.");
        return;
      }

      setPolicy(payload.policy);
    } catch {
      setPolicyError(
        "We could not verify this policy right now. Please try again shortly.",
      );
    } finally {
      setVerifying(false);
    }
  }

  function goToAccident() {
    if (!policy) {
      setPolicyError("Verify a valid policy before continuing.");
      return;
    }
    setStep(2);
  }

  function goToDocuments() {
    const errors = validateAccidentForm(accident);
    setAccidentErrors(errors);
    if (!isAccidentFormValid(accident)) return;
    setStep(3);
  }

  function goToReview() {
    const errors = validateDocuments(files);
    setFileErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setStep(4);
  }

  function onPoliceReportChange(fileList: FileList | null) {
    const file = fileList?.[0] || null;
    if (!file) {
      setFiles((prev) => ({ ...prev, policeReport: null }));
      setFileErrors((prev) => ({ ...prev, policeReport: undefined }));
      return;
    }
    const error = validateFile(file);
    setFileErrors((prev) => ({ ...prev, policeReport: error || undefined }));
    setFiles((prev) => ({ ...prev, policeReport: error ? null : file }));
  }

  function onRepairEstimateChange(fileList: FileList | null) {
    const file = fileList?.[0] || null;
    if (!file) {
      setFiles((prev) => ({ ...prev, repairEstimate: null }));
      setFileErrors((prev) => ({
        ...prev,
        repairEstimate: "A repair estimate is required.",
      }));
      return;
    }
    const error = validateFile(file);
    setFileErrors((prev) => ({
      ...prev,
      repairEstimate: error || undefined,
    }));
    setFiles((prev) => ({ ...prev, repairEstimate: error ? null : file }));
  }

  function onPhotosChange(fileList: FileList | null) {
    const selected = Array.from(fileList || []);
    if (selected.length === 0) {
      setFiles((prev) => ({ ...prev, accidentPhotos: [] }));
      setFileErrors((prev) => ({
        ...prev,
        accidentPhotos: "Add at least one accident photo.",
      }));
      return;
    }

    for (const file of selected) {
      const error = validateFile(file);
      if (error) {
        setFileErrors((prev) => ({ ...prev, accidentPhotos: error }));
        return;
      }
    }

    setFileErrors((prev) => ({ ...prev, accidentPhotos: undefined }));
    setFiles((prev) => ({
      ...prev,
      accidentPhotos: [...prev.accidentPhotos, ...selected],
    }));
  }

  function removePhoto(index: number) {
    setFiles((prev) => ({
      ...prev,
      accidentPhotos: prev.accidentPhotos.filter((_, i) => i !== index),
    }));
  }

  async function handleSubmit() {
    if (!policy) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const formData = new FormData();
      formData.set("policyNumber", policy.policyNumber);
      formData.set("accidentDate", accident.accidentDate);
      formData.set("accidentLocation", accident.accidentLocation);
      formData.set("description", accident.description);
      formData.set("email", accident.email);
      formData.set("phone", accident.phone);

      if (files.policeReport) {
        formData.set("policeReport", files.policeReport);
      }
      if (files.repairEstimate) {
        formData.set("repairEstimate", files.repairEstimate);
      }
      for (const photo of files.accidentPhotos) {
        formData.append("accidentPhotos", photo);
      }

      const response = await fetch("/api/claims", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        ok: boolean;
        claimNumber?: string;
        error?: string;
      };

      if (!payload.ok || !payload.claimNumber) {
        setSubmitError(payload.error || "Claim submission failed.");
        return;
      }

      router.push(
        `/claim/success?claimNumber=${encodeURIComponent(payload.claimNumber)}`,
      );
    } catch {
      setSubmitError(
        "We could not submit your claim right now. Please try again shortly.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <StepIndicator current={step} />

      {step === 1 && (
        <Card className="space-y-5">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-2xl text-[var(--brand-navy)]">
              Policy verification
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Enter your motor policy number to confirm coverage before filing a
              claim.
            </p>
          </div>

          <Field
            label="Policy number"
            htmlFor="policyNumber"
            hint="Test policy: MOT-2026-0001"
          >
            <TextInput
              id="policyNumber"
              name="policyNumber"
              value={policyNumber}
              onChange={(e) => setPolicyNumber(e.target.value.toUpperCase())}
              placeholder="MOT-2026-0001"
              autoComplete="off"
            />
          </Field>

          {policyError ? <Alert tone="error">{policyError}</Alert> : null}

          {policy ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
              <p className="mb-3 text-sm font-semibold text-emerald-800">
                Policy verified and active
              </p>
              <PolicySummary policy={policy} />
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={handleVerifyPolicy}
              disabled={verifying || !policyNumber.trim()}
            >
              {verifying ? "Verifying…" : "Verify Policy"}
            </Button>
            <Button type="button" onClick={goToAccident} disabled={!policy}>
              Continue
            </Button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="space-y-5">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-2xl text-[var(--brand-navy)]">
              Accident details
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Tell us when and where the incident happened, and how we can reach
              you.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Accident date"
              htmlFor="accidentDate"
              error={accidentErrors.accidentDate}
            >
              <TextInput
                id="accidentDate"
                type="date"
                value={accident.accidentDate}
                onChange={(e) =>
                  setAccident((prev) => ({
                    ...prev,
                    accidentDate: e.target.value,
                  }))
                }
              />
            </Field>
            <Field
              label="Accident location"
              htmlFor="accidentLocation"
              error={accidentErrors.accidentLocation}
            >
              <TextInput
                id="accidentLocation"
                value={accident.accidentLocation}
                onChange={(e) =>
                  setAccident((prev) => ({
                    ...prev,
                    accidentLocation: e.target.value,
                  }))
                }
                placeholder="Street, city, landmark"
              />
            </Field>
          </div>

          <Field
            label="Accident description"
            htmlFor="description"
            error={accidentErrors.description}
          >
            <TextArea
              id="description"
              rows={4}
              value={accident.description}
              onChange={(e) =>
                setAccident((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="Briefly describe what happened"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email" htmlFor="email" error={accidentErrors.email}>
              <TextInput
                id="email"
                type="email"
                value={accident.email}
                onChange={(e) =>
                  setAccident((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="you@example.com"
              />
            </Field>
            <Field
              label="Phone number"
              htmlFor="phone"
              error={accidentErrors.phone}
            >
              <TextInput
                id="phone"
                type="tel"
                value={accident.phone}
                onChange={(e) =>
                  setAccident((prev) => ({ ...prev, phone: e.target.value }))
                }
                placeholder="+1 555 0100"
              />
            </Field>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button type="button" onClick={goToDocuments}>
              Continue
            </Button>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card className="space-y-5">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-2xl text-[var(--brand-navy)]">
              Supporting documents
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Upload PDF or image files (JPEG, PNG, WEBP). Max 10 MB each.
            </p>
          </div>

          <Field
            label="Police report (optional)"
            htmlFor="policeReport"
            error={fileErrors.policeReport}
          >
            <TextInput
              id="policeReport"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
              onChange={(e) => onPoliceReportChange(e.target.files)}
            />
            {files.policeReport ? (
              <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span>{files.policeReport.name}</span>
                <Button
                  type="button"
                  variant="danger"
                  className="px-2 py-1 text-xs"
                  onClick={() =>
                    setFiles((prev) => ({ ...prev, policeReport: null }))
                  }
                >
                  Remove
                </Button>
              </div>
            ) : null}
          </Field>

          <Field
            label="Repair estimate (required)"
            htmlFor="repairEstimate"
            error={fileErrors.repairEstimate}
          >
            <TextInput
              id="repairEstimate"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
              onChange={(e) => onRepairEstimateChange(e.target.files)}
            />
            {files.repairEstimate ? (
              <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span>{files.repairEstimate.name}</span>
                <Button
                  type="button"
                  variant="danger"
                  className="px-2 py-1 text-xs"
                  onClick={() =>
                    setFiles((prev) => ({ ...prev, repairEstimate: null }))
                  }
                >
                  Remove
                </Button>
              </div>
            ) : null}
          </Field>

          <Field
            label="Accident photos (required, multiple allowed)"
            htmlFor="accidentPhotos"
            error={fileErrors.accidentPhotos}
          >
            <TextInput
              id="accidentPhotos"
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp,.pdf,application/pdf"
              onChange={(e) => {
                onPhotosChange(e.target.files);
                e.target.value = "";
              }}
            />
            {files.accidentPhotos.length > 0 ? (
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {files.accidentPhotos.map((file, index) => (
                  <li
                    key={`${file.name}-${index}`}
                    className="rounded-xl border border-slate-200 p-3"
                  >
                    {photoPreviews[index]?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photoPreviews[index].url!}
                        alt={file.name}
                        className="mb-2 h-28 w-full rounded-lg object-cover"
                      />
                    ) : null}
                    <div className="flex items-start justify-between gap-2">
                      <span className="break-all text-sm text-slate-700">
                        {file.name}
                      </span>
                      <Button
                        type="button"
                        variant="danger"
                        className="px-2 py-1 text-xs"
                        onClick={() => removePhoto(index)}
                      >
                        Remove
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </Field>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button type="button" onClick={goToReview}>
              Continue to review
            </Button>
          </div>
        </Card>
      )}

      {step === 4 && policy && (
        <Card className="space-y-6">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-2xl text-[var(--brand-navy)]">
              Review & submit
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Confirm the details below, then submit your claim for review.
            </p>
          </div>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Policy & vehicle
            </h3>
            <PolicySummary policy={policy} />
          </section>

          <section className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Accident
              </h3>
              <dl className="mt-2 space-y-2 text-sm">
                <div>
                  <dt className="text-slate-500">Date</dt>
                  <dd className="font-medium">
                    {formatDate(accident.accidentDate)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Location</dt>
                  <dd className="font-medium">{accident.accidentLocation}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Description</dt>
                  <dd className="font-medium whitespace-pre-wrap">
                    {accident.description}
                  </dd>
                </div>
              </dl>
            </div>
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Contact
              </h3>
              <dl className="mt-2 space-y-2 text-sm">
                <div>
                  <dt className="text-slate-500">Email</dt>
                  <dd className="font-medium">{accident.email}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Phone</dt>
                  <dd className="font-medium">{accident.phone}</dd>
                </div>
              </dl>
            </div>
          </section>

          <section className="border-t border-slate-100 pt-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Documents
            </h3>
            <ul className="mt-2 space-y-1 text-sm text-slate-800">
              {files.policeReport ? (
                <li>Police report: {files.policeReport.name}</li>
              ) : (
                <li>Police report: not provided</li>
              )}
              <li>Repair estimate: {files.repairEstimate?.name}</li>
              <li>
                Accident photos:{" "}
                {files.accidentPhotos.map((f) => f.name).join(", ")}
              </li>
            </ul>
          </section>

          {submitError ? <Alert tone="error">{submitError}</Alert> : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep(3)}
              disabled={submitting}
            >
              Back
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Submitting claim…" : "Submit Claim"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
