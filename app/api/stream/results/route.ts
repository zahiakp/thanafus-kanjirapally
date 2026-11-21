import { NextRequest } from "next/server";
import { apiErrorResponse, requireApiSession } from "../../../utils/apiAuth";
import { getResultPlaylist } from "../../../stream/resultPlaylistServer";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const preview = request.nextUrl.searchParams.get("preview") === "1";
    if (preview) await requireApiSession(["admin"]);
    const authorization = request.headers.get("authorization") || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
    return Response.json(await getResultPlaylist(token, preview), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}
