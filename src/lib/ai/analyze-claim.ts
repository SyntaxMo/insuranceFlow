import "server-only";

import { OpenRouter } from "@openrouter/sdk";
import {
  BadGatewayResponseError,
  ConnectionError,
  NotFoundResponseError,
  OpenRouterError,
  ProviderOverloadedResponseError,
  RequestTimeoutError,
  ServiceUnavailableResponseError,
  TooManyRequestsResponseError,
  UnauthorizedResponseError,
} from "@openrouter/sdk/models/errors";
import { getClaimById } from "@/lib/claims/admin";
import { prepareClaimDocuments } from "@/lib/ai/documents";
import { ClaimAnalysisError } from "@/lib/ai/errors";
import { CLAIM_ANALYSIS_SYSTEM_PROMPT } from "@/lib/ai/prompt";
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

function requireOpenRouterKey(): string {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) {
    throw new ClaimAnalysisError(
      "AI analysis is not configured. The OpenRouter API key is missing.",
      500,
    );
  }
  return key;
}

function mapOpenRouterError(err: unknown): ClaimAnalysisError {
  if (err instanceof ClaimAnalysisError) return err;

  if (err instanceof UnauthorizedResponseError) {
    return new ClaimAnalysisError(
      "AI analysis is not authorized. Check the OpenRouter API key.",
      502,
    );
  }
  if (err instanceof TooManyRequestsResponseError) {
    return new ClaimAnalysisError(
      "The AI service is rate-limited right now. Please try again shortly.",
      429,
    );
  }
  if (
    err instanceof ServiceUnavailableResponseError ||
    err instanceof ProviderOverloadedResponseError ||
    err instanceof NotFoundResponseError ||
    err instanceof BadGatewayResponseError
  ) {
    return new ClaimAnalysisError(
      "The selected AI model is temporarily unavailable. Please try again shortly.",
      503,
    );
  }
  if (err instanceof ConnectionError || err instanceof RequestTimeoutError) {
    return new ClaimAnalysisError(
      "The AI service could not be reached. Please try again.",
      502,
    );
  }
  if (err instanceof OpenRouterError) {
    console.error("OpenRouter request failed:", err.statusCode);
    return new ClaimAnalysisError(
      "The AI analysis request failed. Please try again.",
      502,
    );
  }

  console.error("Unexpected AI analysis error:", err);
  return new ClaimAnalysisError(
    "Unable to analyze this claim right now. Please try again.",
    500,
  );
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
  documents: Awaited<ReturnType<typeof prepareClaimDocuments>>,
): string {
  const vehicle = `${claim.policy.vehicle.make} ${claim.policy.vehicle.model} (${claim.policy.vehicle.year})`;
  const documentInventory = documents.map((doc) => ({
    type: documentTypeLabel(doc.documentType),
    fileName: doc.fileName,
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
        policyStatus: claim.policyStatus,
        coverageType: claim.policy.coverageType,
        excessAmount: claim.policy.excessAmount,
        coverageLimit: claim.policy.coverageLimit,
        policyStartDate: claim.policy.startDate,
        policyEndDate: claim.policy.endDate,
        vehicleMake: claim.policy.vehicle.make,
        vehicleModel: claim.policy.vehicle.model,
        vehicleYear: claim.policy.vehicle.year,
        plateNumber: claim.policy.vehicle.plateNumber,
        vehicleLabel: vehicle,
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
): Promise<ClaimAnalysisResult> {
  const apiKey = requireOpenRouterKey();
  const { claim, error } = await getClaimById(claimId);

  if (!claim) {
    throw new ClaimAnalysisError(
      error || "Claim not found.",
      error === "Claim not found." ? 404 : 400,
    );
  }

  const documents = await prepareClaimDocuments(claim);
  const userContent: UserContentPart[] = [
    { type: "text", text: buildUserText(claim, documents) },
  ];

  for (const doc of documents) {
    if (!doc.dataUrl || !doc.mimeType) continue;
    userContent.push({
      type: "text",
      text: `Attached document: ${documentTypeLabel(doc.documentType)} (${doc.fileName}).`,
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
          filename: doc.fileName,
          fileData: doc.dataUrl,
        },
      });
    }
  }

  const openrouter = new OpenRouter({
    apiKey,
    appTitle: "InsureFlow",
    httpReferer: "https://insureflow.local",
    timeoutMs: 120_000,
  });

  let response: unknown;
  try {
    response = await openrouter.chat.send({
      chatRequest: {
        model: CLAIM_AI_MODEL,
        stream: false,
        maxTokens: 4096,
        plugins: [
          {
            id: "file-parser",
            pdf: { engine: "native" },
          },
        ],
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
    });
  } catch (err) {
    throw mapOpenRouterError(err);
  }

  const content = assistantText(response as { choices?: Array<{ message?: { content?: string | Array<{ text?: string }> | null; refusal?: string | null } }> });
  const json = extractJsonObject(content);
  const analysis = parseClaimAnalysis(json, {
    model: CLAIM_AI_MODEL,
    updatedAt: new Date().toISOString(),
  });

  return saveClaimAnalysis(claim.id, analysis);
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
