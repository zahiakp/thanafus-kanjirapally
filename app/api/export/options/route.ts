import { apiErrorResponse, requireApiSession } from "../../../utils/apiAuth";
import { getExportOptions } from "../../../config/export/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireApiSession(["admin"]);
    return Response.json(await getExportOptions(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
