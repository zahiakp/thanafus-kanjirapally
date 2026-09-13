import { NextRequest } from "next/server";
import { apiErrorResponse, requireApiSession } from "../../../utils/apiAuth";
import { positiveInteger } from "../../../utils/validation";
import { getStreamAdmin } from "../../../stream/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireApiSession(["admin"]);
    const value = request.nextUrl.searchParams.get("program");
    const programId = value ? positiveInteger(value, "program") : undefined;
    return Response.json(await getStreamAdmin(programId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}

