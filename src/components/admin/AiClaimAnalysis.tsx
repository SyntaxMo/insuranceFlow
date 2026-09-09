"use client";

import { useState } from "react";
import { Alert, Button, Card } from "@/components/ui/Forms";
import { formatCurrency } from "@/lib/format";
import type { ClaimAnalysisResult } from "@/types/ai-analysis";

function isClaimAnalysisResult(value: unknown): value is ClaimAnalysisResult {
  if (!value || typeof value !== "object") return false;
  const data = value as ClaimAnalysisResult;
  return (
    typeof data.summary === "string" &&
    Boolean(data.extractedInformation) &&
    Array.isArray(data.missingInformation) &&
    Array.isArray(data.inconsistencies) &&
    Array.isArray(data.riskFlags)
  );
}

function ListBlock({
  items,
  emptyMessage,
}: {
  items: string[];
  emptyMessage: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">{emptyMessage}</p>;
  }

  return (
    <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-800">
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  );
}

function ExtractedValue({
  label,
  value,
}: {
  label: string;
  value: string | number | null;
}) {
  const display =
    value === null || value === ""
      ? "—"
      : typeof value === "number"
        ? formatCurrency(value)
        : value;

  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-medium whitespace-pre-wrap text-slate-900">{display}</dd>
    </div>
  );
}

function AnalysisBody({ analysis }: { analysis: ClaimAnalysisResult }) {
  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-[var(--brand-navy)]">
          Claim Summary
        </h3>
        <p className="text-sm leading-6 text-slate-700">{analysis.summary}</p>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-[var(--brand-navy)]">
          Extracted Information
        </h3>
        <dl className="grid gap-3 sm:grid-cols-2">
          <ExtractedValue
            label="Accident date"
            value={analysis.extractedInformation.accidentDate}
          />
          <ExtractedValue
            label="Accident location"
            value={analysis.extractedInformation.accidentLocation}
          />
          <ExtractedValue
            label="Vehicle"
            value={analysis.extractedInformation.vehicle}
          />
          <ExtractedValue
            label="Repair estimate amount"
            value={analysis.extractedInformation.repairEstimateAmount}
          />
          <ExtractedValue
            label="Police report number"
            value={analysis.extractedInformation.policeReportNumber}
          />
          <ExtractedValue
            label="Police report details"
            value={analysis.extractedInformation.policeReportDetails}
          />
        </dl>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="mb-1 text-xs text-slate-500">Visible vehicle damage</p>
            <ListBlock
              items={analysis.extractedInformation.visibleVehicleDamage}
              emptyMessage="—"
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-slate-500">Other vehicles mentioned</p>
            <ListBlock
              items={analysis.extractedInformation.otherVehiclesMentioned}
              emptyMessage="—"
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-slate-500">Other parties mentioned</p>
            <ListBlock
              items={analysis.extractedInformation.otherPartiesMentioned}
              emptyMessage="—"
            />
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-[var(--brand-navy)]">
          Missing Information
        </h3>
        <ListBlock
          items={analysis.missingInformation}
          emptyMessage="No important missing information detected."
        />
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-[var(--brand-navy)]">
          Inconsistencies
        </h3>
        <ListBlock
          items={analysis.inconsistencies}
          emptyMessage="No inconsistencies detected."
        />
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-[var(--brand-navy)]">
          Risk Flags
        </h3>
        <ListBlock
          items={analysis.riskFlags}
          emptyMessage="No risk flags detected."
        />
      </section>
    </div>
  );
}

export function AiClaimAnalysis({
  claimId,
  initialAnalysis = null,
  initialError = null,
  setupSql = null,
}: {
  claimId: string;
  initialAnalysis?: ClaimAnalysisResult | null;
  initialError?: string | null;
  setupSql?: string | null;
}) {
  const [analysis, setAnalysis] = useState<ClaimAnalysisResult | null>(
    initialAnalysis,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [sql, setSql] = useState<string | null>(setupSql);

  async function handleAnalyze() {
    setLoading(true);
    setError(null);
    setSql(null);

    try {
      const response = await fetch(`/api/admin/claims/${claimId}/analyze`, {
        method: "POST",
      });
      const payload = (await response.json()) as unknown;

      if (!response.ok) {
        const record =
          payload && typeof payload === "object"
            ? (payload as { error?: unknown; setupSql?: unknown })
            : {};
        const message =
          typeof record.error === "string"
            ? record.error
            : "Unable to analyze this claim right now.";
        setError(message);
        if (typeof record.setupSql === "string") setSql(record.setupSql);
        return;
      }

      const wrapped =
        payload &&
        typeof payload === "object" &&
        "analysis" in payload
          ? (payload as { analysis: unknown }).analysis
          : payload;

      if (!isClaimAnalysisResult(wrapped)) {
        setError("The analysis response was not in the expected format.");
        return;
      }

      setAnalysis(wrapped);
    } catch {
      setError("Unable to analyze this claim right now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            AI Claim Analysis
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Structured assistance for the claims officer. The AI does not approve
            or reject the claim.
          </p>
        </div>
        <Button type="button" onClick={handleAnalyze} disabled={loading}>
          {loading ? "Analyzing claim..." : "Analyze with AI"}
        </Button>
      </div>

      {error ? (
        <Alert tone="error">
          <p className="font-semibold">Analysis failed</p>
          <p className="mt-1">{error}</p>
          {sql ? (
            <pre className="mt-3 overflow-x-auto rounded-lg bg-white/70 p-3 text-xs text-slate-800">
              {sql}
            </pre>
          ) : null}
        </Alert>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-600">Analyzing claim...</p>
      ) : null}

      {!loading && !analysis && !error ? (
        <p className="text-sm text-slate-600">
          This claim has not been analyzed yet.
        </p>
      ) : null}

      {analysis ? <AnalysisBody analysis={analysis} /> : null}

      <p className="text-xs text-slate-400">
        AI-assisted analysis. Final review must be completed by a claims officer.
      </p>
    </Card>
  );
}
