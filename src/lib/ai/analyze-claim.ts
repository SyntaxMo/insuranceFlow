import "server-only";

import { OpenRouter } from "@openrouter/sdk";
import {
  BadGatewayResponseError,
  ConnectionError,
  ForbiddenResponseError,
  NotFoundResponseError,
  OpenRouterError,
  PaymentRequiredResponseError,
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
import {
  hasRecognizableSecret,
  redactSecrets,
  safeErrorDetails,
} from "@/lib/ai/debug";
import { documentTypeLabel } from "@/lib/validation/claim";
import type { ClaimAnalysisResult } from "@/types/ai-analysis";
import { CLAIM_AI_MODEL } from "@/types/ai-analysis";
import type { ClaimDetailView } from "@/types/database";

type UserContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; imageUrl: { url: string } }
  | { type: "file"; file: { filename: string; fileData: string } };

export type ClaimAnalysisInputMode = "text" | "images" | "pdfs" | "all";

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

function mapOpenRouterError(err: unknown): ClaimAnalysisError {
  if (err instanceof ClaimAnalysisError) return err;

  if (err instanceof OpenRouterError) {
    console.error("[claim-analysis] OpenRouter request failed:", safeErrorDetails(err));
  }

  if (err instanceof UnauthorizedResponseError) {
    return new ClaimAnalysisError(
      "AI analysis is not authorized. Check the OpenRouter API key.",
      502,
    );
  }
  if (err instanceof PaymentRequiredResponseError) {
    return new ClaimAnalysisError(
      "The AI service could not process the submitted files right now.",
      502,
    );
  }
  if (err instanceof ForbiddenResponseError) {
    return new ClaimAnalysisError(
      "The selected AI model is not available to this application.",
      503,
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
    return new ClaimAnalysisError(
      "The AI analysis request failed. Please try again.",
      502,
    );
  }

  console.error("[claim-analysis] unexpected OpenRouter error:", safeErrorDetails(err));
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
  documents: Awaited<ReturnType<typeof prepareClaimDocuments>> = [],
): string {
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
  const apiKey = requireOpenRouterKey();
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
  const documents =
    inputMode === "text" ? [] : await prepareClaimDocuments(claim);
  console.info("[claim-analysis] documents prepared:", {
    total: documents.length,
    images: documents.filter((document) => document.kind === "image").length,
    pdfs: documents.filter((document) => document.kind === "pdf").length,
    inaccessible: documents.filter((document) => document.kind === "inaccessible").length,
    unsupported: documents.filter((document) => document.kind === "unsupported").length,
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
      retries: {
        strategy: "backoff",
        backoff: {
          initialInterval: 1_000,
          maxInterval: 5_000,
          exponent: 1.5,
          maxElapsedTime: 20_000,
        },
        retryConnectionErrors: true,
      },
      retryCodes: ["429", "5XX"],
    });
  } catch (err) {
    throw mapOpenRouterError(err);
  }

  const content = assistantText(response as { choices?: Array<{ message?: { content?: string | Array<{ text?: string }> | null; refusal?: string | null } }> });
  console.info("[claim-analysis] model returned content:", Boolean(content));
  if (content) {
    if (hasRecognizableSecret(content)) {
      console.info("[claim-analysis] raw model content omitted because it may contain a secret.");
    } else {
      console.info("[claim-analysis] raw model content:", redactSecrets(content));
    }
  }
  const json = extractJsonObject(content);
  const analysis = parseClaimAnalysis(json, {
    model: CLAIM_AI_MODEL,
    updatedAt: new Date().toISOString(),
  });

  console.info("[claim-analysis] JSON parsed and schema validated.");
  const saved = await saveClaimAnalysis(claim.id, analysis);
  console.info("[claim-analysis] analysis saved:", { claimId: claim.id });
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
