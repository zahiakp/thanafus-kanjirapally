import { cookies } from "next/headers";
import { SESSION_COOKIE, SessionUser, verifySessionToken } from "./session";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function requireApiSession(roles?: string[]): Promise<SessionUser> {
  const session = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) throw new ApiError("Authentication required", 401);
  if (roles && !roles.includes(session.role)) throw new ApiError("Permission denied", 403);
  return session;
}

export function apiErrorResponse(error: unknown) {
  const known = error instanceof ApiError;
  const validation = error instanceof Error && error.name === "RequestValidationError";
  const status = known ? error.status : validation ? 400 : 500;
  if (status === 500) console.error(error);
  return Response.json(
    { success: false, message: status === 500 ? "Internal server error" : (error as Error).message },
    { status }
  );
}
