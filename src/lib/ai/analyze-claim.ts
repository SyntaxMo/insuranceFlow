import "server-only";

import { OpenRouter } from "@openrouter/sdk";
import { getClaimById } from "@/lib/claims/admin";
import { prepareClaimDocuments } from "@/lib/ai/documents";
import { ClaimAnalysisError } from "@/lib/ai/errors";
import { CLAIM_ANALYSIS_SYSTEM_PROMPT } from "@/lib/ai/prompt";
import {
  classifyProviderFailure,
  providerFailureLogDetails,
  type ProviderFailureInfo,
} from "@/lib/ai/provider-errors";
import { extractJsonObject, parseClaimAnalysis } from "@/lib/ai/schema";
import { getSavedClaimAnalysis, saveClaimAnalysis } from "@/lib/ai/store";
import { documentTypeLabel } from "@/lib/validation/claim";
import type { ClaimAnalysisResult } from "@/types/ai-analysis";
import { CLAIM_AI_MODEL } from "@/types/ai-analysis";
import type { ClaimDetailView } from "@/types/database";

type UserContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; imageUrl: { url: string } }
  | { type: "file"; file: { filename: string; fileData: string } };

export type ClaimAnalysisInputMode = "text" | "images" | "pdfs" | "all";

const PROVIDER_REQUEST_TIMEOUT_MS = 80_000;
const PROVIDER_TOTAL_BUDGET_MS = 92_000;
const MIN_RETRY_BUDGET_MS = 1_000;

function requireOpenRouterKey(): string {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  console.info("[claim-analysis] OPENROUTER_API_KEY configured:", Boolean(key));
  if (!key) {
    throw new ClaimAnalysisError(
      "AI analysis is not configured. The OpenRouter API key is missing.",
      500,
    );
  }
  return key;
}

function mapOpenRouterError(
  err: unknown,
  info = classifyProviderFailure(err),
): ClaimAnalysisError {
  if (err instanceof ClaimAnalysisError) return err;

  const status =
    info.category === "PROVIDER_CAPACITY"
      ? 503
      : info.category === "PROVIDER_TIMEOUT"
        ? 504
        : info.category === "PROVIDER_ERROR"
          ? 502
          : 500;
  return new ClaimAnalysisError(
    "Unable to analyze this claim right now. Please try again.",
    status,
    undefined,
    info.category,
  );
}

export async function requestWithOneTransientRetry<T>(
  request: (attempt: number) => Promise<T>,
  options: {
    canRetry?: () => boolean;
    onFailure?: (info: ProviderFailureInfo, attempt: number) => void;
  } = {},
): Promise<T> {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await request(attempt);
    } catch (error) {
      const info = classifyProviderFailure(error);
      options.onFailure?.(info, attempt);
      const canRetry = options.canRetry?.() ?? true;
      if (attempt === 1 && info.retryable && canRetry) continue;
      throw error;
    }
  }
  throw new Error("Unreachable provider retry state.");
}

function assistantText(response: {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string }> | null;
      refusal?: string | null;
    };
  }>;
}): string {
  const message = response.choices?.[0]?.message;
  if (message?.refusal) {
    throw new ClaimAnalysisError(
      "The AI declined to analyze this claim. Please try again.",
      502,
    );
  }

  const content = message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part.text === "string" ? part.text : ""))
      .join("\n")
      .trim();
  }
  return "";
}

function buildUserText(
  claim: ClaimDetailView,
  documents: Awaited<ReturnType<typeof prepareClaimDocuments>> = [],
): string {
  const documentInventory = documents.map((doc) => ({
    type: documentTypeLabel(doc.documentType),
    status: doc.note,
    attached: Boolean(doc.dataUrl),
  }));

  return [
    "Analyze this motor insurance claim for a human claims officer.",
    "Use only the information below and any attached files.",
    "",
    "Submitted claim record:",
    JSON.stringify(
      {
        claimNumber: claim.claimNumber,
        accidentDate: claim.accidentDate,
        accidentLocation: claim.accidentLocation,
        accidentDescription: claim.description,
        policyNumber: claim.policy.policyNumber,
        coverageType: claim.policy.coverageType,
        excessAmount: claim.policy.excessAmount,
        coverageLimit: claim.policy.coverageLimit,
        vehicleMake: claim.policy.vehicle.make,
        vehicleModel: claim.policy.vehicle.model,
        vehicleYear: claim.policy.vehicle.year,
        plateNumber: claim.policy.vehicle.plateNumber,
      },
      null,
      2,
    ),
    "",
    documents.length === 0
      ? "No supporting documents were submitted with this claim."
      : `Submitted documents:\n${JSON.stringify(documentInventory, null, 2)}`,
    "",
    "Return JSON only.",
  ].join("\n");
}

export async function analyzeClaimWithOpenRouter(
  claimId: string,
  inputMode: ClaimAnalysisInputMode = "all",
): Promise<ClaimAnalysisResult> {
  const savedAnalysis = await getSavedClaimAnalysis(claimId);
  if (savedAnalysis) {
    console.info("[claim-analysis] using saved analysis:", { claimId });
    return savedAnalysis;
  }

  const apiKey = requireOpenRouterKey();
  const analysisStartedAt = Date.now();
  console.info("[claim-analysis] starting:", { claimId, inputMode, model: CLAIM_AI_MODEL });
  const { claim, error } = await getClaimById(claimId);

  if (!claim) {
    console.error("[claim-analysis] claim loading failed:", {
      claimId,
      message: error || "Claim not found.",
    });
    throw new ClaimAnalysisError(
      error || "Claim not found.",
      error === "Claim not found." ? 404 : 400,
    );
  }

  console.info("[claim-analysis] claim loaded:", { claimId: claim.id });
  const documentStartedAt = Date.now();
  let documents: Awaited<ReturnType<typeof prepareClaimDocuments>>;
  try {
    documents = inputMode === "text" ? [] : await prepareClaimDocuments(claim);
  } catch {
    console.error("[claim-analysis] document processing failed:", {
      claimId,
      category: "DOCUMENT_PROCESSING_ERROR",
      durationMs: Date.now() - documentStartedAt,
    });
    throw new ClaimAnalysisError(
      "Unable to analyze this claim right now. Please try again.",
      502,
      undefined,
      "DOCUMENT_PROCESSING_ERROR",
    );
  }
  console.info("[claim-analysis] documents prepared:", {
    total: documents.length,
    images: documents.filter((document) => document.kind === "image").length,
    pdfs: documents.filter((document) => document.kind === "pdf").length,
    inaccessible: documents.filter((document) => document.kind === "inaccessible").length,
    unsupported: documents.filter((document) => document.kind === "unsupported").length,
    totalBytes: documents.reduce((sum, document) => sum + document.byteSize, 0),
    durationMs: Date.now() - documentStartedAt,
  });
  const includedDocuments = documents.filter((document) => {
    if (inputMode === "images") return document.kind === "image";
    if (inputMode === "pdfs") return document.kind === "pdf";
    return true;
  });
  const userContent: UserContentPart[] = [
    { type: "text", text: buildUserText(claim, includedDocuments) },
  ];

  for (const doc of includedDocuments) {
    if (!doc.dataUrl || !doc.mimeType) continue;
    userContent.push({
      type: "text",
      text: `Attached document: ${documentTypeLabel(doc.documentType)}.`,
    });
    if (doc.kind === "image") {
      userContent.push({
        type: "image_url",
        imageUrl: { url: doc.dataUrl },
      });
    } else if (doc.kind === "pdf") {
      userContent.push({
        type: "file",
        file: {
          filename: `${doc.documentType.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`,
          fileData: doc.dataUrl,
        },
      });
    }
  }

  const openrouter = new OpenRouter({
    apiKey,
    appTitle: "InsureFlow",
    httpReferer: "https://insureflow.local",
    timeoutMs: PROVIDER_REQUEST_TIMEOUT_MS,
  });

  let response: unknown;
  const providerStartedAt = Date.now();
  try {
    response = await requestWithOneTransientRetry(
      async (attempt) => {
        const elapsedMs = Date.now() - providerStartedAt;
        const remainingMs = PROVIDER_TOTAL_BUDGET_MS - elapsedMs;
        const timeoutMs = Math.min(PROVIDER_REQUEST_TIMEOUT_MS, remainingMs);
        if (timeoutMs < MIN_RETRY_BUDGET_MS) {
          const timeout = new Error("Provider time budget exhausted.");
          timeout.name = "TimeoutError";
          throw timeout;
        }
        console.info("[claim-analysis] provider attempt starting:", {
          claimId,
          model: CLAIM_AI_MODEL,
          attempt,
          timeoutMs,
          images: includedDocuments.filter((document) => document.kind === "image").length,
          pdfs: includedDocuments.filter((document) => document.kind === "pdf").length,
          totalBytes: includedDocuments.reduce((sum, document) => sum + document.byteSize, 0),
        });
        return openrouter.chat.send({
          chatRequest: {
            model: CLAIM_AI_MODEL,
            stream: false,
            maxTokens: 4096,
            ...(userContent.some((part) => part.type === "file")
              ? {
                  plugins: [
                    {
                      id: "file-parser" as const,
                      pdf: { engine: "cloudflare-ai" as const },
                    },
                  ],
                }
              : {}),
            messages: [
              {
                role: "system",
                content: CLAIM_ANALYSIS_SYSTEM_PROMPT,
              },
              {
                role: "user",
                content: userContent,
              },
            ],
          },
        }, {
          timeoutMs,
          retries: { strategy: "none" },
        });
      },
      {
        canRetry: () =>
          PROVIDER_TOTAL_BUDGET_MS - (Date.now() - providerStartedAt) >=
          MIN_RETRY_BUDGET_MS,
        onFailure: (info, attempt) => {
          console.error("[claim-analysis] provider attempt failed:", {
            claimId,
            model: CLAIM_AI_MODEL,
            attempt,
            durationMs: Date.now() - providerStartedAt,
            ...providerFailureLogDetails(info),
          });
        },
      },
    );
  } catch (err) {
    throw mapOpenRouterError(err);
  }

  console.info("[claim-analysis] provider response received:", {
    claimId,
    model: CLAIM_AI_MODEL,
    durationMs: Date.now() - providerStartedAt,
  });

  const content = assistantText(response as { choices?: Array<{ message?: { content?: string | Array<{ text?: string }> | null; refusal?: string | null } }> });
  console.info("[claim-analysis] model response received:", {
    hasContent: Boolean(content),
    contentLength: content.length,
  });
  const json = extractJsonObject(content);
  const analysis = parseClaimAnalysis(json, {
    model: CLAIM_AI_MODEL,
    updatedAt: new Date().toISOString(),
  });

  console.info("[claim-analysis] JSON parsed and schema validated.");
  const saved = await saveClaimAnalysis(claim.id, analysis);
  console.info("[claim-analysis] analysis saved:", {
    claimId: claim.id,
    totalDurationMs: Date.now() - analysisStartedAt,
  });
  return saved;
}

export async function loadClaimAnalysis(
  claimId: string,
): Promise<{
  analysis: ClaimAnalysisResult | null;
  error: string | null;
  supabaseSql?: string;
}> {
  try {
    const analysis = await getSavedClaimAnalysis(claimId);
    return { analysis, error: null };
  } catch (err) {
    if (err instanceof ClaimAnalysisError) {
      return {
        analysis: null,
        error: err.message,
        supabaseSql: err.supabaseSql,
      };
    }
    return {
      analysis: null,
      error: "Unable to load the saved AI analysis right now.",
    };
  }
}
