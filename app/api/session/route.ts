import { apiErrorResponse, requireApiSession } from "../../utils/apiAuth";
import { SESSION_MAX_AGE } from "../../utils/session";

export async function GET() {
  try {
    const session = await requireApiSession();
    const profile = { ...session } as typeof session & { exp?: number };
    delete profile.exp;

    return Response.json({
      success: true,
      data: profile,
      maxAge: SESSION_MAX_AGE,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}