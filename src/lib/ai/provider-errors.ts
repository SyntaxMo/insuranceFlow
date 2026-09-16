export type ClaimAnalysisFailureCategory =
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_CAPACITY"
  | "PROVIDER_ERROR"
  | "DOCUMENT_PROCESSING_ERROR"
  | "INVALID_MODEL_RESPONSE"
  | "INTERNAL_ERROR";

export interface ProviderFailureInfo {
  category: ClaimAnalysisFailureCategory;
  retryable: boolean;
  statusCode?: number;
  providerRequestId?: string;
  providerErrorCode?: string;
  providerErrorType?: string;
}

type ErrorLike = {
  name?: unknown;
  message?: unknown;
  statusCode?: unknown;
  body?: unknown;
  rawValue?: unknown;
};

function parseEnvelope(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return undefined;
}

export function classifyProviderFailure(error: unknown): ProviderFailureInfo {
  const candidate =
    error && typeof error === "object" ? (error as ErrorLike) : {};
  const envelope =
    parseEnvelope(candidate.body) ?? parseEnvelope(candidate.rawValue);
  const providerError =
    envelope?.error && typeof envelope.error === "object"
      ? (envelope.error as Record<string, unknown>)
      : null;
  const metadata =
    providerError?.metadata && typeof providerError.metadata === "object"
      ? (providerError.metadata as Record<string, unknown>)
      : null;
  const name = asString(candidate.name) ?? "";
  const message = asString(candidate.message) ?? "";
  const providerMessage = asString(providerError?.message) ?? "";
  const providerErrorCode = asString(providerError?.code);
  const providerErrorType = asString(metadata?.error_type);
  const statusCode =
    typeof candidate.statusCode === "number"
      ? candidate.statusCode
      : providerErrorCode && /^\d+$/.test(providerErrorCode)
        ? Number(providerErrorCode)
        : undefined;
  const combined = `${name} ${message} ${providerMessage} ${providerErrorType}`.toLowerCase();
  const base = {
    ...(statusCode ? { statusCode } : {}),
    ...(asString(envelope?.id)
      ? { providerRequestId: asString(envelope?.id) }
      : {}),
    ...(providerErrorCode ? { providerErrorCode } : {}),
    ...(providerErrorType ? { providerErrorType } : {}),
  };

  if (
    name === "TimeoutError" ||
    combined.includes("requesttimeouterror") ||
    combined.includes("requesttimeoutresponseerror") ||
    combined.includes("edgenetworktimeout") ||
    combined.includes("aborted due to timeout") ||
    combined.includes("timed out")
  ) {
    return { category: "PROVIDER_TIMEOUT", retryable: false, ...base };
  }

  if (
    statusCode === 429 ||
    combined.includes("resourceexhausted") ||
    combined.includes("provider_unavailable") ||
    combined.includes("provideroverloaded") ||
    combined.includes("capacity") ||
    combined.includes("rate limit")
  ) {
    return { category: "PROVIDER_CAPACITY", retryable: true, ...base };
  }

  if (
    (statusCode !== undefined && statusCode >= 400) ||
    combined.includes("openroutererror") ||
    combined.includes("connectionerror") ||
    combined.includes("responsevalidationerror")
  ) {
    return {
      category: "PROVIDER_ERROR",
      retryable: statusCode !== undefined && statusCode >= 500,
      ...base,
    };
  }

  return { category: "INTERNAL_ERROR", retryable: false, ...base };
}

export function providerFailureLogDetails(
  info: ProviderFailureInfo,
): Record<string, unknown> {
  return {
    category: info.category,
    retryable: info.retryable,
    ...(info.statusCode ? { statusCode: info.statusCode } : {}),
    ...(info.providerRequestId
      ? { providerRequestId: info.providerRequestId }
      : {}),
    ...(info.providerErrorCode
      ? { providerErrorCode: info.providerErrorCode }
      : {}),
    ...(info.providerErrorType
      ? { providerErrorType: info.providerErrorType }
      : {}),
  };
}

