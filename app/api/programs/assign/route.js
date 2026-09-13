import { apiErrorResponse, ApiError, requireApiSession } from "../../../utils/apiAuth";

export async function POST() {
  try {
    await requireApiSession(["admin"]);
    throw new ApiError("Filesystem-based program assignment has been retired; use the database-backed program APIs", 410);
  } catch (error) { return apiErrorResponse(error); }
}
