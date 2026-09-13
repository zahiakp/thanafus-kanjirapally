export class RequestValidationError extends Error {}

export function objectBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RequestValidationError("A JSON object is required");
  return value as Record<string, unknown>;
}

export function requiredString(body: Record<string, unknown>, key: string, max = 255) {
  const value = body[key];
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new RequestValidationError(`${key} is invalid`);
  return value.trim();
}

export function positiveInteger(value: unknown, key: string) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new RequestValidationError(`${key} must be a positive integer`);
  return parsed;
}
