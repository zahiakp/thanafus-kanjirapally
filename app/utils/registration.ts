export const registrationCloseAt = process.env.NEXT_PUBLIC_REGISTRATION_CLOSE_AT?.trim() || "";

export function isRegistrationClosed(now = Date.now()) {
  if (!registrationCloseAt) return false;

  const closeAt = Date.parse(registrationCloseAt);
  // A configured but malformed deadline fails closed instead of silently
  // leaving registration open.
  return !Number.isFinite(closeAt) || now > closeAt;
}

export const isClosed = isRegistrationClosed();