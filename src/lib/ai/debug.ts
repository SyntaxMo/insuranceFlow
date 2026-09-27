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

export function safeErrorDetails(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    if (error && typeof error === "object") {
      const candidate = error as Record<string, unknown>;
      const details: Record<string, unknown> = {};
      for (const key of ["name", "statusCode", "code"]) {
        const value = candidate[key];
        if (typeof value === "string") details[key] = value.slice(0, 80);
        if (typeof value === "number") details[key] = value;
      }
      return Object.keys(details).length > 0 ? details : { name: "UnknownError" };
    }
    return { name: "UnknownError" };
  }

  const candidate = error as Error & {
    statusCode?: unknown;
    code?: unknown;
  };

  return {
    name: error.name,
    ...(typeof candidate.statusCode === "number"
      ? { statusCode: candidate.statusCode }
      : {}),
    ...(typeof candidate.code === "string"
      ? { code: candidate.code.slice(0, 80) }
      : {}),
  };
}
