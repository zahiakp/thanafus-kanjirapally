import { NextRequest } from "next/server";
import { apiErrorResponse, requireApiSession } from "../../../utils/apiAuth";
import { getStreamState } from "../../../stream/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const screen = request.nextUrl.searchParams.get("screen") || "";
    if (screen !== "main") return Response.json({ success: false, message: "Unknown stream screen" }, { status: 404 });
    const preview = request.nextUrl.searchParams.get("preview") === "1";
    if (preview) await requireApiSession(["admin"]);
    const authorization = request.headers.get("authorization") || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
    const result = await getStreamState(request.nextUrl.searchParams.get("version") || undefined, token, preview);
    return Response.json(result, { headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return apiErrorResponse(error); }
}

