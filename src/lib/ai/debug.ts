import "server-only";

const SECRET_PATTERNS = [
  /sk-or-v1-[A-Za-z0-9_-]+/gi,
  /(?:bearer|authorization)\s*[:=]?\s*[A-Za-z0-9._~+\/-]+/gi,
  /(?:api[_-]?key|service[_-]?role[_-]?key|access[_-]?token|secret)\s*["']?\s*[:=]\s*["']?[^\s,"'}]+/gi,
];

export function redactSecrets(value: string): string {
  return SECRET_PATTERNS.reduce(
    (redacted, pattern) => redacted.replace(pattern, "[REDACTED]"),
    value,
  );
}

export function hasRecognizableSecret(value: string): boolean {
  return SECRET_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(value);
  });
}

function safeResponseBody(body: string): string {
  try {
    const sanitize = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(sanitize);
      if (!value || typeof value !== "object") {
        return typeof value === "string" ? redactSecrets(value) : value;
      }
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).flatMap(([key, item]) =>
          ["file_annotations", "user_id", "api_key", "authorization"].includes(
            key.toLowerCase(),
          )
            ? []
            : [[key, sanitize(item)]],
        ),
      );
    };
    return JSON.stringify(sanitize(JSON.parse(body)));
  } catch {
    return redactSecrets(body);
  }
}

export function safeErrorDetails(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    if (error && typeof error === "object") {
      const candidate = error as Record<string, unknown>;
      const details: Record<string, unknown> = {};
      for (const key of [
        "name",
        "message",
        "statusCode",
        "code",
        "details",
        "hint",
      ]) {
        const value = candidate[key];
        if (typeof value === "string") details[key] = redactSecrets(value);
        if (typeof value === "number") details[key] = value;
      }
      return details;
    }
    return { value: redactSecrets(String(error)) };
  }

  const candidate = error as Error & {
    statusCode?: unknown;
    body?: unknown;
    code?: unknown;
    details?: unknown;
    hint?: unknown;
  };

  return {
    name: error.name,
    message: redactSecrets(error.message),
    ...(typeof candidate.statusCode === "number"
      ? { statusCode: candidate.statusCode }
      : {}),
    ...(typeof candidate.code === "string"
      ? { code: redactSecrets(candidate.code) }
      : {}),
    ...(typeof candidate.body === "string"
      ? { body: safeResponseBody(candidate.body) }
      : {}),
    ...(typeof candidate.details === "string"
      ? { details: redactSecrets(candidate.details) }
      : {}),
    ...(typeof candidate.hint === "string"
      ? { hint: redactSecrets(candidate.hint) }
      : {}),
  };
}
